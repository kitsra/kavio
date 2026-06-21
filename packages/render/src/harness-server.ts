import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { getCanvasDimensions } from "@kitsra/kavio-core";
import { createRenderHarnessHtml } from "@kitsra/kavio-browser-renderer";
import type { KavioAssetDefinition, KavioDocument } from "@kitsra/kavio-schema";

export interface RenderHarnessServer {
  url: string;
  close(): Promise<void>;
}

export interface CreateRenderHarnessServerOptions {
  composition: KavioDocument;
}

/**
 * Tiny localhost static server that feeds the headless render harness page to
 * Chromium: the shared harness HTML, `/composition.json`, and the vendored
 * `@kitsra/kavio-core` and `@kitsra/kavio-browser-renderer` ESM bundles.
 */
export async function createRenderHarnessServer(
  options: CreateRenderHarnessServerOptions
): Promise<RenderHarnessServer> {
  const { composition, assets } = prepareHarnessComposition(options.composition);
  const dimensions = getCanvasDimensions(composition.composition);
  const html = createRenderHarnessHtml({
    width: dimensions.width,
    height: dimensions.height,
    fps: composition.composition.fps,
    durationFrames: composition.composition.durationFrames
  });
  const compositionJson = `${JSON.stringify(composition)}\n`;

  const [coreSource, browserRendererSource] = await Promise.all([
    readFile(new URL("../../core/dist/index.js", import.meta.url), "utf8"),
    readFile(new URL("../../browser-renderer/dist/index.js", import.meta.url), "utf8")
  ]);

  const server = createServer((request, response) => {
    handleRequest(request, response, { html, compositionJson, coreSource, browserRendererSource, assets });
  });

  const port = await listenOnLocalhost(server);

  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => closeServer(server)
  };
}

interface HarnessAssets {
  html: string;
  compositionJson: string;
  coreSource: string;
  browserRendererSource: string;
  assets: Map<string, ServedAsset>;
}

interface ServedAsset {
  path: string;
  contentType: string;
}

function handleRequest(request: IncomingMessage, response: ServerResponse, assets: HarnessAssets): void {
  const path = (request.url ?? "/").split("?", 1)[0] ?? "/";

  if (path === "/" || path === "/index.html") {
    send(response, 200, "text/html; charset=utf-8", assets.html);
    return;
  }

  if (path === "/composition.json") {
    send(response, 200, "application/json; charset=utf-8", assets.compositionJson);
    return;
  }

  if (path === "/vendor/core/index.js") {
    send(response, 200, "text/javascript; charset=utf-8", assets.coreSource);
    return;
  }

  if (path === "/vendor/browser-renderer/index.js") {
    send(response, 200, "text/javascript; charset=utf-8", assets.browserRendererSource);
    return;
  }

  const assetId = assetIdFromPath(path);
  if (assetId !== null) {
    const asset = assets.assets.get(assetId);
    if (asset === undefined) {
      send(response, 404, "text/plain; charset=utf-8", "Not found.\n");
      return;
    }
    void sendFile(response, asset);
    return;
  }

  send(response, 404, "text/plain; charset=utf-8", "Not found.\n");
}

function send(response: ServerResponse, statusCode: number, contentType: string, value: string): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", contentType);
  response.setHeader("cache-control", "no-store");
  response.end(value);
}

async function sendFile(response: ServerResponse, asset: ServedAsset): Promise<void> {
  try {
    const bytes = await readFile(asset.path);
    response.statusCode = 200;
    response.setHeader("content-type", asset.contentType);
    response.setHeader("cache-control", "no-store");
    response.end(bytes);
  } catch {
    send(response, 404, "text/plain; charset=utf-8", "Not found.\n");
  }
}

function prepareHarnessComposition(composition: KavioDocument): { composition: KavioDocument; assets: Map<string, ServedAsset> } {
  const assets = new Map<string, ServedAsset>();
  const clone = JSON.parse(JSON.stringify(composition)) as KavioDocument;

  for (const [assetId, asset] of Object.entries(clone.assets)) {
    const localPath = localAssetPath(asset.src);
    if (localPath === null) {
      continue;
    }

    const servedId = encodeURIComponent(assetId);
    assets.set(servedId, { path: localPath, contentType: contentTypeForPath(localPath, asset) });
    asset.src = `/assets/${servedId}`;
  }

  return { composition: clone, assets };
}

function localAssetPath(src: string): string | null {
  if (src.startsWith("/")) {
    return src;
  }

  if (src.startsWith("file://")) {
    try {
      return decodeURIComponent(new URL(src).pathname);
    } catch {
      return null;
    }
  }

  return null;
}

function assetIdFromPath(path: string): string | null {
  if (!path.startsWith("/assets/")) {
    return null;
  }
  return path.slice("/assets/".length);
}

function contentTypeForPath(path: string, asset: KavioAssetDefinition): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (lower.endsWith(".mp4")) {
    return "video/mp4";
  }
  if (lower.endsWith(".webm")) {
    return "video/webm";
  }
  if (lower.endsWith(".wav")) {
    return "audio/wav";
  }
  if (lower.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  if (lower.endsWith(".woff2")) {
    return "font/woff2";
  }
  if (lower.endsWith(".woff")) {
    return "font/woff";
  }
  return asset.type === "font" ? "font/woff2" : "application/octet-stream";
}

function listenOnLocalhost(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address !== null && typeof address === "object" && typeof address.port === "number") {
        resolve(address.port);
        return;
      }
      reject(new Error("Harness server did not return a TCP address."));
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
