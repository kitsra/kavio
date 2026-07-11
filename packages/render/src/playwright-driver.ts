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
  setContent(html: string): Promise<unknown>;
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
  close(): Promise<void>;
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
  /** Render deterministic body markup for a frame instead of using Kavio's DOM harness. */
  renderHtmlFrame?: HtmlFrameRenderer;
  /** CSS installed once for custom HTML frame rendering. */
  htmlStyles?: string;
}

export type HtmlFrameRenderer = (frame: number, composition: KavioDocument) => string | Promise<string>;

/** Worker-local Chromium pool. Each driver still owns an isolated context and harness. */
export class PlaywrightSession {
  private readonly browsers: Promise<PlaywrightBrowser>[] = [];
  private launches = 0;
  private closed = false;

  constructor(
    private readonly options: PlaywrightDriverOptions = {},
    private readonly launcher: () => Promise<PlaywrightBrowser> = launchBrowser
  ) {}

  get launchCount(): number {
    return this.launches;
  }

  createDriver(): PlaywrightDriver {
    if (this.closed) {
      throw new Error("PlaywrightSession.createDriver called after close().");
    }
    return new PlaywrightDriver(this.options, this);
  }

  async browser(index: number): Promise<PlaywrightBrowser> {
    if (this.closed) {
      throw new Error("PlaywrightSession browser requested after close().");
    }
    let browser = this.browsers[index];
    if (browser === undefined) {
      browser = this.launcher().then((launched) => {
        this.launches += 1;
        return launched;
      });
      this.browsers[index] = browser;
    }
    return browser;
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    const browsers = await Promise.allSettled(this.browsers);
    const closes = await Promise.allSettled(
      browsers.flatMap((result) => result.status === "fulfilled" ? [result.value.close()] : [])
    );
    const failure = closes.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failure !== undefined) {
      throw failure.reason;
    }
  }
}

/**
 * Concrete BrowserDriver backed by Playwright + bundled Chromium. Launches with
 * the deterministic flags, serves the headless harness page, and captures one
 * transparent PNG per frame. Real binaries are exercised only in the gated e2e.
 */
export class PlaywrightDriver implements BrowserDriver {
  private context: PlaywrightContext | null = null;
  private page: PlaywrightPage | null = null;
  private cdp: PlaywrightCdpSession | null = null;
  private server: RenderHarnessServer | null = null;
  private viewport: BrowserViewport | null = null;
  private readonly deviceScaleFactor: number;
  private readonly readyTimeoutMs: number;
  private readonly renderHtmlFrame: HtmlFrameRenderer | undefined;
  private readonly htmlStyles: string;
  private readonly sharedSession: PlaywrightSession | undefined;
  private session: PlaywrightSession | null = null;
  private forkIndex = 1;
  private observedLaunches = 0;
  private composition: KavioDocument | null = null;

  /** Chromium version string, available after open() for render metadata. */
  chromiumVersion: string | null = null;

  constructor(options: PlaywrightDriverOptions = {}, session?: PlaywrightSession) {
    this.deviceScaleFactor = options.deviceScaleFactor ?? 1;
    this.readyTimeoutMs = options.readyTimeoutMs ?? 30_000;
    this.renderHtmlFrame = options.renderHtmlFrame;
    this.htmlStyles = options.htmlStyles ?? "";
    this.sharedSession = session;
  }

  /** Chromium launches observed by this driver's session, for non-wall-clock timing diagnostics. */
  get browserLaunches(): number {
    return this.session?.launchCount ?? this.sharedSession?.launchCount ?? this.observedLaunches;
  }

  async open(composition: KavioDocument, options: BrowserOpenOptions = {}): Promise<void> {
    const viewport = options.viewport ?? createBrowserViewport(composition, this.deviceScaleFactor);
    this.viewport = viewport;
    this.composition = composition;

    this.session = this.sharedSession ?? new PlaywrightSession({
      deviceScaleFactor: this.deviceScaleFactor,
      readyTimeoutMs: this.readyTimeoutMs
    });
    this.forkIndex = 1;
    const browser = await this.session.browser(0);
    this.chromiumVersion = browser.version();
    this.context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor
    });
    this.page = await this.context.newPage();

    if (this.renderHtmlFrame === undefined) {
      this.server = await createRenderHarnessServer({ composition });
      await this.page.goto(this.server.url);
      await this.page.waitForFunction("window.__kavioReady === true", undefined, { timeout: this.readyTimeoutMs });
    } else {
      await this.page.setContent(createHtmlShell(this.htmlStyles));
    }
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

    const prepareFrame = this.renderHtmlFrame === undefined
      ? undefined
      : () => prepareHtmlFrame(this.page!, this.renderHtmlFrame!(frame, this.composition!), this.readyTimeoutMs);
    return renderFrameOnPage(this.page, this.cdp, this.viewport, frame, options, prepareFrame);
  }

  /**
   * Open a sibling context against this driver's harness server. The session
   * assigns one retained Chromium process per capture worker because Chromium
   * serializes screenshot capture inside one process.
   */
  async fork(): Promise<BrowserDriver> {
    const { server, session, viewport, composition } = this;
    if (session === null || viewport === null || composition === null || (this.renderHtmlFrame === undefined && server === null)) {
      throw renderError({
        code: "RENDER_FAILED",
        stage: "render",
        message: "PlaywrightDriver.fork called before open()."
      });
    }
    const browserIndex = this.forkIndex;
    this.forkIndex += 1;
    const browser = await session.browser(browserIndex);
    let context: PlaywrightContext | null = null;
    try {
      context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor
      });
      const page = await context.newPage();
      if (this.renderHtmlFrame === undefined) {
        await page.goto(server!.url);
        await page.waitForFunction("window.__kavioReady === true", undefined, { timeout: this.readyTimeoutMs });
      } else {
        await page.setContent(createHtmlShell(this.htmlStyles));
      }
      const cdp = await createFastScreenshotSession(context, page);
      return new PlaywrightForkDriver(
        context,
        page,
        cdp,
        viewport,
        this.readyTimeoutMs,
        this.renderHtmlFrame === undefined
          ? undefined
          : (frame) => this.renderHtmlFrame!(frame, composition)
      );
    } catch (error) {
      await context?.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    const context = this.context;
    const server = this.server;
    const session = this.session;
    this.context = null;
    this.page = null;
    this.server = null;
    this.viewport = null;
    this.session = null;
    this.composition = null;

    const jobCleanup = await Promise.allSettled([
      ...(context === null ? [] : [context.close()]),
      ...(server === null ? [] : [server.close()])
    ]);
    let failure = jobCleanup.find((result): result is PromiseRejectedResult => result.status === "rejected")?.reason;
    if (session !== null) {
      this.observedLaunches = session.launchCount;
    }
    if (session !== null && this.sharedSession === undefined) {
      try {
        await session.close();
      } catch (error) {
        failure ??= error;
      }
    }
    if (failure !== undefined) {
      throw failure;
    }
  }
}

/** Fork of a PlaywrightDriver: an isolated context on a session worker browser. */
class PlaywrightForkDriver implements BrowserDriver {
  constructor(
    private readonly context: PlaywrightContext,
    private readonly page: PlaywrightPage,
    private readonly cdp: PlaywrightCdpSession | null,
    private readonly viewport: BrowserViewport,
    private readonly readyTimeoutMs: number,
    private readonly renderHtmlFrame?: (frame: number) => string | Promise<string>
  ) {}

  async open(): Promise<void> {
    throw renderError({
      code: "RENDER_FAILED",
      stage: "render",
      message: "Forked Playwright drivers are already open."
    });
  }

  async renderFrame(frame: number, options: BrowserFrameCaptureOptions = {}): Promise<BrowserFrameCapture> {
    const prepareFrame = this.renderHtmlFrame === undefined
      ? undefined
      : () => prepareHtmlFrame(this.page, this.renderHtmlFrame!(frame), this.readyTimeoutMs);
    return renderFrameOnPage(this.page, this.cdp, this.viewport, frame, options, prepareFrame);
  }

  async close(): Promise<void> {
    await this.context.close();
  }
}

async function launchBrowser(): Promise<PlaywrightBrowser> {
  const chromium = await loadChromium();
  try {
    return await chromium.launch({
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
  options: BrowserFrameCaptureOptions,
  prepareFrame?: () => Promise<void>
): Promise<BrowserFrameCapture> {
  const omitBackground = options.omitBackground ?? true;
  const evaluateStart = performance.now();
  if (prepareFrame === undefined) {
    await page.evaluate(`window.__kavio.renderFrame(${frame})`);
  } else {
    await prepareFrame();
  }
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

async function prepareHtmlFrame(
  page: PlaywrightPage,
  markup: string | Promise<string>,
  readyTimeoutMs: number
): Promise<void> {
  const body = await markup;
  await page.evaluate(`document.body.innerHTML = ${JSON.stringify(body)}`);
  await page.evaluate("document.fonts.ready");
  await page.waitForFunction("Array.from(document.images).every((image) => image.complete)", undefined, {
    timeout: readyTimeoutMs
  });
}

function createHtmlShell(styles: string): string {
  const safeStyles = styles.replaceAll("</style", "<\\/style");
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}${safeStyles}</style></head><body></body></html>`;
}

function missingBrowserExecutable(message: string): boolean {
  return message.includes("Executable doesn't exist") || message.includes("playwright install");
}
