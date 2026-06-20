import { mkdir, readFile, stat } from "node:fs/promises";
import { createServer, type Server, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface PlaywrightBrowser {
  newContext(options: {
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
  }): Promise<PlaywrightContext>;
  close(): Promise<void>;
}

interface PlaywrightContext {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

interface PlaywrightPage {
  emulateMedia(options: { reducedMotion: "reduce" | "no-preference" }): Promise<void>;
  goto(url: string, options: { waitUntil: "networkidle" | "load" }): Promise<unknown>;
  screenshot(options: { path: string; fullPage: boolean }): Promise<unknown>;
}

interface PlaywrightModule {
  chromium: {
    launch(options: { headless: boolean }): Promise<PlaywrightBrowser>;
  };
}

export interface CapturedScreenshot {
  id: string;
  label: string;
  path: string;
}

const renderRequire = createRequire(new URL("../../../packages/render/package.json", import.meta.url));
const playwright = renderRequire("playwright") as PlaywrightModule;

const siteRoot = fileURLToPath(new URL("../../../site/", import.meta.url));
const screenshotRoot = fileURLToPath(new URL("../assets/screenshots/", import.meta.url));

const targets = [
  { id: "home", path: "index.html", label: "Kavio site home" },
  { id: "docs", path: "docs.html", label: "Documentation hub" },
  { id: "packages", path: "packages.html", label: "Package overview" }
] as const;

export async function captureWebsiteScreenshots(): Promise<CapturedScreenshot[]> {
  await mkdir(screenshotRoot, { recursive: true });
  const server = await startStaticServer(siteRoot);
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2
  });

  try {
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    const captures: CapturedScreenshot[] = [];

    for (const target of targets) {
      const outputPath = join(screenshotRoot, `${target.id}.png`);
      await page.goto(`${server.url}/${target.path}`, { waitUntil: "networkidle" });
      await page.screenshot({ path: outputPath, fullPage: false });
      captures.push({ id: target.id, label: target.label, path: outputPath });
    }

    return captures;
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }
}

async function startStaticServer(root: string): Promise<{ url: string; close(): Promise<void> }> {
  const server = createServer((request, response) => {
    const requestPath = (request.url ?? "/").split("?", 1)[0] ?? "/";
    const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    const candidate = resolve(root, normalize(relativePath));

    if (!candidate.startsWith(root)) {
      send(response, 403, "text/plain; charset=utf-8", "Forbidden.\n");
      return;
    }

    void sendFile(response, candidate);
  });

  const port = await listen(server);
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => close(server)
  };
}

async function sendFile(response: ServerResponse, path: string): Promise<void> {
  try {
    await stat(path);
    const bytes = await readFile(path);
    response.statusCode = 200;
    response.setHeader("content-type", contentType(path));
    response.setHeader("cache-control", "no-store");
    response.end(bytes);
  } catch {
    send(response, 404, "text/plain; charset=utf-8", "Not found.\n");
  }
}

function send(response: ServerResponse, statusCode: number, contentType: string, value: string): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", contentType);
  response.setHeader("cache-control", "no-store");
  response.end(value);
}

function contentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
    case ".jsonld":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".xml":
      return "application/xml; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function listen(server: Server): Promise<number> {
  return new Promise((resolvePort, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address !== null && typeof address === "object") {
        resolvePort(address.port);
        return;
      }
      reject(new Error("Static site server did not return a port."));
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolveClose();
    });
  });
}
