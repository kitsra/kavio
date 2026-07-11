import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { KavioDocument } from "@kitsra/kavio-schema";
import { createReactFrameRenderer, useCurrentFrame, useVideoConfig } from "./index.js";

const composition: KavioDocument = {
  version: "0.1",
  composition: { width: 1280, height: 720, fps: 30, durationFrames: 90 },
  assets: {},
  layers: [],
  exports: [{ name: "main", format: "mp4", width: 1280, height: 720 }]
};

function Frame({ title }: { title: string }) {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  return createElement("main", { "data-frame": frame }, `${title}:${config.width}x${config.height}`);
}

const renderFrame = createReactFrameRenderer({ component: Frame, props: { title: "Demo" } });
const frame12 = await renderFrame(12, composition);
assertEqual(frame12, '<main data-frame="12">Demo:1280x720</main>', "renders frame context to static markup");
assertEqual(await renderFrame(12, composition), frame12, "same frame is deterministic");
assert((await renderFrame(13, composition)).includes('data-frame="13"'), "frame changes are observable");

let outsideProviderError = "";
try {
  renderToStaticMarkup(createElement(Frame, { title: "Invalid" }));
} catch (error) {
  outsideProviderError = error instanceof Error ? error.message : String(error);
}
assert(outsideProviderError.includes("inside a React frame renderer"), "hooks reject use outside the frame provider");

console.log("@kitsra/kavio-react self-check passed");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: string, expected: string, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}
