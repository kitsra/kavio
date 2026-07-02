import { Buffer } from "node:buffer";
import {
  createBrowserViewport,
  createPngFrameCapture,
  DEFAULT_CHROMIUM_LAUNCH_OPTIONS,
  type BrowserDriver,
  type BrowserFrameCapture,
  type BrowserFrameCaptureOptions,
  type BrowserOpenOptions,
  type BrowserViewport
} from "@kitsra/kavio-render-worker";
import type { KavioDocument } from "@kitsra/kavio-schema";
import { renderError } from "./errors.js";
import { createRenderHarnessServer, type RenderHarnessServer } from "./harness-server.js";

// Minimal structural view of the Playwright API surface we use. Playwright is
// loaded via a non-literal dynamic import so its own `.d.ts` (which requires
// @types/node) is never pulled into this no-@types/node project.
interface PlaywrightPage {
  goto(url: string): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
  waitForFunction(expression: string, arg?: unknown, options?: { timeout?: number }): Promise<unknown>;
  screenshot(options?: { type?: "png"; omitBackground?: boolean }): Promise<Uint8Array>;
  close(): Promise<void>;
}

interface PlaywrightCdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

interface PlaywrightContext {
  newPage(): Promise<PlaywrightPage>;
  newCDPSession(page: PlaywrightPage): Promise<PlaywrightCdpSession>;
}

interface PlaywrightBrowser {
  newContext(options?: { viewport?: { width: number; height: number }; deviceScaleFactor?: number }): Promise<PlaywrightContext>;
  version(): string;
  close(): Promise<void>;
}

interface PlaywrightChromium {
  launch(options?: { headless?: boolean; args?: readonly string[] }): Promise<PlaywrightBrowser>;
}

interface PlaywrightModule {
  chromium: PlaywrightChromium;
}

async function loadChromium(): Promise<PlaywrightChromium> {
  const specifier = "playwright";
  try {
    const mod = (await import(specifier)) as unknown as PlaywrightModule;
    return mod.chromium;
  } catch {
    throw renderError({
      code: "BINARY_MISSING",
      stage: "render",
      message: "Playwright (bundled Chromium) is not available.",
      hint: "Install render browser binaries with 'corepack pnpm run install:render-browsers'."
    });
  }
}

export interface PlaywrightDriverOptions {
  deviceScaleFactor?: number;
  readyTimeoutMs?: number;
}

/**
 * Concrete BrowserDriver backed by Playwright + bundled Chromium. Launches with
 * the deterministic flags, serves the headless harness page, and captures one
 * transparent PNG per frame. Real binaries are exercised only in the gated e2e.
 */
export class PlaywrightDriver implements BrowserDriver {
  private browser: PlaywrightBrowser | null = null;
  private context: PlaywrightContext | null = null;
  private page: PlaywrightPage | null = null;
  private cdp: PlaywrightCdpSession | null = null;
  private server: RenderHarnessServer | null = null;
  private viewport: BrowserViewport | null = null;
  private readonly deviceScaleFactor: number;
  private readonly readyTimeoutMs: number;

  /** Chromium version string, available after open() for render metadata. */
  chromiumVersion: string | null = null;

  constructor(options: PlaywrightDriverOptions = {}) {
    this.deviceScaleFactor = options.deviceScaleFactor ?? 1;
    this.readyTimeoutMs = options.readyTimeoutMs ?? 30_000;
  }

  async open(composition: KavioDocument, options: BrowserOpenOptions = {}): Promise<void> {
    const viewport = options.viewport ?? createBrowserViewport(composition, this.deviceScaleFactor);
    this.viewport = viewport;

    const chromium = await loadChromium();
    try {
      this.browser = await chromium.launch({
        headless: DEFAULT_CHROMIUM_LAUNCH_OPTIONS.headless,
        args: DEFAULT_CHROMIUM_LAUNCH_OPTIONS.args
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (missingBrowserExecutable(message)) {
        throw renderError({
          code: "BINARY_MISSING",
          stage: "render",
          message: "Playwright Chromium is not installed for Kavio rendering.",
          hint: "Install render browser binaries with 'corepack pnpm run install:render-browsers'."
        });
      }
      throw renderError({
        code: "RENDER_FAILED",
        stage: "render",
        message: `Failed to launch Playwright Chromium: ${message}`
      });
    }
    this.chromiumVersion = this.browser.version();
    this.context = await this.browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor
    });
    this.page = await this.context.newPage();

    this.server = await createRenderHarnessServer({ composition });
    await this.page.goto(this.server.url);
    await this.page.waitForFunction("window.__kavioReady === true", undefined, { timeout: this.readyTimeoutMs });
    this.cdp = await createFastScreenshotSession(this.context, this.page);
  }

  async renderFrame(frame: number, options: BrowserFrameCaptureOptions = {}): Promise<BrowserFrameCapture> {
    if (this.page === null || this.viewport === null) {
      throw renderError({
        code: "RENDER_FRAME_FAILED",
        stage: "render",
        message: "PlaywrightDriver.renderFrame called before open()."
      });
    }

    return renderFrameOnPage(this.page, this.cdp, this.viewport, frame, options);
  }

  /**
   * Launch a sibling Chromium process against this driver's harness server,
   * ready to render frames for the same composition. Chromium serializes
   * screenshot capture inside one browser process, so true capture
   * parallelism needs one process per worker; the harness server and its
   * composition stay owned by this driver.
   */
  async fork(): Promise<BrowserDriver> {
    if (this.server === null || this.viewport === null) {
      throw renderError({
        code: "RENDER_FAILED",
        stage: "render",
        message: "PlaywrightDriver.fork called before open()."
      });
    }
    const chromium = await loadChromium();
    const browser = await chromium.launch({
      headless: DEFAULT_CHROMIUM_LAUNCH_OPTIONS.headless,
      args: DEFAULT_CHROMIUM_LAUNCH_OPTIONS.args
    });
    try {
      const context = await browser.newContext({
        viewport: { width: this.viewport.width, height: this.viewport.height },
        deviceScaleFactor: this.viewport.deviceScaleFactor
      });
      const page = await context.newPage();
      await page.goto(this.server.url);
      await page.waitForFunction("window.__kavioReady === true", undefined, { timeout: this.readyTimeoutMs });
      const cdp = await createFastScreenshotSession(context, page);
      return new PlaywrightForkDriver(browser, page, cdp, this.viewport);
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.browser?.close();
    } finally {
      await this.server?.close();
    }
    this.browser = null;
    this.context = null;
    this.page = null;
    this.server = null;
    this.viewport = null;
  }
}

/** Fork of a PlaywrightDriver: its own Chromium process on the shared harness server. */
class PlaywrightForkDriver implements BrowserDriver {
  constructor(
    private readonly browser: PlaywrightBrowser,
    private readonly page: PlaywrightPage,
    private readonly cdp: PlaywrightCdpSession | null,
    private readonly viewport: BrowserViewport
  ) {}

  async open(): Promise<void> {
    throw renderError({
      code: "RENDER_FAILED",
      stage: "render",
      message: "Forked Playwright drivers are already open."
    });
  }

  async renderFrame(frame: number, options: BrowserFrameCaptureOptions = {}): Promise<BrowserFrameCapture> {
    return renderFrameOnPage(this.page, this.cdp, this.viewport, frame, options);
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}

/**
 * Prepare a raw CDP screenshot session: the transparent-background override is
 * applied once here instead of per page.screenshot() call, and captures use
 * Page.captureScreenshot with optimizeForSpeed (fastest PNG compression level;
 * identical decoded pixels, so encoded outputs stay deterministic). Returns
 * null when CDP is unavailable so capture falls back to page.screenshot().
 */
async function createFastScreenshotSession(
  context: PlaywrightContext,
  page: PlaywrightPage
): Promise<PlaywrightCdpSession | null> {
  try {
    const session = await context.newCDPSession(page);
    await session.send("Emulation.setDefaultBackgroundColorOverride", {
      color: { r: 0, g: 0, b: 0, a: 0 }
    });
    return session;
  } catch {
    return null;
  }
}

async function renderFrameOnPage(
  page: PlaywrightPage,
  cdp: PlaywrightCdpSession | null,
  viewport: BrowserViewport,
  frame: number,
  options: BrowserFrameCaptureOptions
): Promise<BrowserFrameCapture> {
  const omitBackground = options.omitBackground ?? true;
  const evaluateStart = performance.now();
  await page.evaluate(`window.__kavio.renderFrame(${frame})`);
  const screenshotStart = performance.now();
  let bytes: Uint8Array;
  if (cdp !== null && omitBackground) {
    const result = (await cdp.send("Page.captureScreenshot", {
      format: "png",
      optimizeForSpeed: true
    })) as { data: string };
    bytes = Buffer.from(result.data, "base64");
  } else {
    bytes = await page.screenshot({ type: "png", omitBackground });
  }
  const screenshotEnd = performance.now();

  return createPngFrameCapture({
    frame,
    bytes,
    viewport,
    omitBackground,
    timing: { evaluateMs: screenshotStart - evaluateStart, screenshotMs: screenshotEnd - screenshotStart }
  });
}

function missingBrowserExecutable(message: string): boolean {
  return message.includes("Executable doesn't exist") || message.includes("playwright install");
}
