import type { KavioDocument } from "@kavio/schema";
import { assembleRenderCommand } from "./assemble-command.js";
import { renderError, RENDER_ERROR_CODES } from "./errors.js";
import { createRenderHarnessServer } from "./harness-server.js";
import { createFfmpegRunner, type FfmpegChildProcess, type FfmpegSpawn } from "./ffmpeg-runner.js";
import { renderComposition } from "./render-composition.js";
import { renderBatch } from "./render-batch.js";
import { FakeBrowserDriver, createFakeFfmpegRunner } from "./testing.js";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

// --- errors.ts -------------------------------------------------------------

const ffmpegFailure = renderError({
  code: "FFMPEG_FAILED",
  stage: "ffmpeg",
  message: "boom",
  hint: "check args"
});
assertEqual(ffmpegFailure.code, "FFMPEG_FAILED", "code preserved");
assertEqual(ffmpegFailure.stage, "ffmpeg", "stage preserved");
assertEqual(ffmpegFailure.severity, "error", "defaults to error severity");
assertEqual(ffmpegFailure.path, "", "defaults to empty path");
assertEqual(ffmpegFailure.retryable, false, "defaults to not retryable");
assertEqual(ffmpegFailure.hint, "check args", "hint preserved");
assert(RENDER_ERROR_CODES.includes("RENDER_TIMEOUT"), "code catalog exported");

const retryable = renderError({
  code: "ASSET_FETCH_FAILED",
  stage: "ingest",
  message: "network",
  retryable: true
});
assertEqual(retryable.retryable, true, "retryable flag honored");
assertEqual(retryable.hint, undefined, "hint omitted when not provided");

// --- assemble-command.ts ---------------------------------------------------

const graphicsOnlyView: KavioDocument = {
  version: "0.1",
  composition: { width: 1080, height: 1920, fps: 30, durationFrames: 30, background: "#101820" },
  assets: {},
  layers: [
    { id: "bg", type: "shape", shape: "rect", fill: "#101820", startFrame: 0, durationFrames: 30 },
    { id: "headline", type: "text", text: "Hello", startFrame: 0, durationFrames: 30 }
  ],
  audio: [],
  exports: [{ name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920 }]
};

const hybridView: KavioDocument = {
  version: "0.1",
  composition: { width: 1080, height: 1920, fps: 30, durationFrames: 30, background: "#000000" },
  assets: {
    clip: { type: "video", src: "clip.mp4" },
    music: { type: "audio", src: "music.mp3" }
  },
  layers: [{ id: "bg", type: "video", asset: "clip", fit: "cover", startFrame: 0, durationFrames: 30 }],
  audio: [{ id: "music", asset: "music", role: "music", startFrame: 0, durationFrames: 30, volume: 0.7 }],
  exports: [{ name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920 }]
};

const graphicsArgs = assembleRenderCommand({
  view: graphicsOnlyView,
  preset: graphicsOnlyView.exports[0]!,
  framePattern: "/tmp/work/overlay-%05d.png"
});
const graphics = graphicsArgs.join(" ");
assert(graphics.includes("color=c="), "graphics-only synthesizes a color base source");
assert(graphics.includes("overlay-%05d.png"), "reads the overlay frame sequence");
assert(graphics.includes("[video_out]"), "maps a final composited video stream");
assert(graphics.includes("[audio_out]"), "maps a final audio stream");
assert(graphics.includes("anullsrc"), "graphics-only synthesizes silent audio");
assert(graphics.includes("yuv420p"), "encodes with yuv420p pixel format");
assert(graphics.includes("+faststart"), "adds faststart for mp4");
assert(graphicsArgs.at(-1)?.endsWith(".mp4") ?? false, "last arg is the output path");
assertEqual(graphicsArgs.filter((arg) => arg === "-filter_complex").length, 1, "emits a single -filter_complex");

const unsafeBackgroundView: KavioDocument = {
  ...graphicsOnlyView,
  composition: {
    ...graphicsOnlyView.composition,
    background: "red;blue,green[0]:white'black\\end"
  }
};
const unsafeBackgroundArgs = assembleRenderCommand({
  view: unsafeBackgroundView,
  preset: unsafeBackgroundView.exports[0]!,
  framePattern: "/tmp/work/overlay-%05d.png"
});
const unsafeBackgroundInput = unsafeBackgroundArgs[unsafeBackgroundArgs.indexOf("-i") + 1] ?? "";
assert(
  unsafeBackgroundInput.includes("red\\;blue\\,green\\[0\\]\\:white\\'black\\\\end"),
  "lavfi background escapes filter metacharacters"
);

const hybridArgs = assembleRenderCommand({
  view: hybridView,
  preset: hybridView.exports[0]!,
  framePattern: "/tmp/work/overlay-%05d.png"
}).join(" ");
assert(hybridArgs.includes("-i clip.mp4"), "declares the source video input");
assert(hybridArgs.includes("overlay="), "composites the overlay over the base");
assert(hybridArgs.includes("amix="), "mixes the declared audio track");
assert(hybridArgs.includes("-i music.mp3"), "declares the audio input");

const webmView: KavioDocument = {
  ...graphicsOnlyView,
  exports: [{ name: "web", format: "webm", width: 1080, height: 1920 }]
};
const webmArgs = assembleRenderCommand({
  view: webmView,
  preset: webmView.exports[0]!,
  framePattern: "/tmp/work/overlay-%05d.png"
}).join(" ");
assert(webmArgs.includes("-c:v libvpx-vp9"), "webm defaults to VP9 video");
assert(webmArgs.includes("-c:a libopus"), "webm defaults to Opus audio");
assert(!webmArgs.includes("+faststart"), "webm does not use mp4/mov faststart flags");

// --- harness-server.ts -----------------------------------------------------

const harnessServer = await createRenderHarnessServer({ composition: graphicsOnlyView });
try {
  const servedHtml = await fetch(harnessServer.url).then((response) => response.text());
  assert(servedHtml.includes("/composition.json"), "harness server serves the harness html");
  assert(servedHtml.includes("/vendor/browser-renderer/index.js"), "harness html references the vendored renderer");
  const servedComposition = (await fetch(`${harnessServer.url}composition.json`).then((response) =>
    response.json()
  )) as { version?: string };
  assertEqual(servedComposition.version, graphicsOnlyView.version, "harness server serves the composition json");
  const vendorCore = await fetch(`${harnessServer.url}vendor/core/index.js`);
  assertEqual(vendorCore.status, 200, "harness server serves the vendored core bundle");
  const missing = await fetch(`${harnessServer.url}nope`);
  assertEqual(missing.status, 404, "harness server returns 404 for unknown routes");
} finally {
  await harnessServer.close();
}

// --- ffmpeg-runner.ts ------------------------------------------------------

function fakeSpawnExit(code: number): FfmpegSpawn {
  return () =>
    ({
      stdout: { on() {} },
      stderr: { on() {} },
      on(event: string, listener: (value: number | null) => void) {
        if (event === "close") {
          setTimeout(() => listener(code), 0);
        }
      },
      kill() {}
    }) as unknown as FfmpegChildProcess;
}

const ffmpegOk = await createFfmpegRunner({ spawn: fakeSpawnExit(0), resolveBinary: () => "ffmpeg" }).run(["-version"]);
assertEqual(ffmpegOk.code, 0, "ffmpeg runner resolves on zero exit");

let ffmpegFailed = false;
try {
  await createFfmpegRunner({ spawn: fakeSpawnExit(1), resolveBinary: () => "ffmpeg" }).run(["bad"]);
} catch (error) {
  ffmpegFailed = (error as { code?: string }).code === "FFMPEG_FAILED";
}
assert(ffmpegFailed, "ffmpeg runner rejects with FFMPEG_FAILED on non-zero exit");

// --- render-composition.ts -------------------------------------------------

const templateDoc: KavioDocument = {
  version: "0.1",
  composition: { width: 1080, height: 1920, fps: 30, durationFrames: 6, background: "#101820" },
  assets: {},
  layers: [
    { id: "bg", type: "shape", shape: "rect", fill: "#101820", startFrame: 0, durationFrames: 6 },
    { id: "headline", type: "text", text: "{{headline}}", startFrame: 0, durationFrames: 6 }
  ],
  audio: [],
  exports: [{ name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920 }]
};

const outDir = await mkdtemp(join(tmpdir(), "kavio-render-test-"));

const successDriver = new FakeBrowserDriver();
const successRunner = createFakeFfmpegRunner();
const successResult = await renderComposition(templateDoc, {
  preset: "reels",
  propValues: { headline: "Hi" },
  outDir,
  driver: successDriver,
  ffmpegRunner: successRunner
});
assert(successResult.ok === true, "render succeeds with fakes");
if (successResult.ok) {
  assert(successResult.outputPath.endsWith(".mp4"), "produces an mp4 path");
  assert(successResult.metadata.tools.ffmpeg.version.length > 0, "records ffmpeg version");
  assert(successResult.metadata.checksums.length === 1, "records an output checksum");
  assertEqual(successResult.metadata.codecs.video, "h264", "mp4 metadata records the effective video codec");
  assertEqual(successResult.metadata.codecs.audio, "aac", "mp4 metadata records the effective audio codec");
}
assertEqual(successDriver.renderedFrames.length, 6, "captures every frame");
assertEqual(successDriver.closes, 1, "closes the browser driver on success");
assertEqual(successRunner.calls.length, 1, "invokes ffmpeg once");

const webmRenderDoc: KavioDocument = {
  ...templateDoc,
  exports: [{ name: "web", format: "webm", width: 1080, height: 1920 }]
};
const webmRenderResult = await renderComposition(webmRenderDoc, {
  preset: "web",
  propValues: { headline: "Web" },
  outDir,
  driver: new FakeBrowserDriver(),
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(webmRenderResult.ok === true, "webm render succeeds with fakes");
if (webmRenderResult.ok) {
  assertEqual(webmRenderResult.metadata.codecs.video, "vp9", "webm metadata records VP9 default");
  assertEqual(webmRenderResult.metadata.codecs.audio, "opus", "webm metadata records Opus default");
}

const invalidDoc: KavioDocument = {
  ...templateDoc,
  composition: { ...templateDoc.composition, durationFrames: 0 }
};
const invalidResult = await renderComposition(invalidDoc, {
  preset: "reels",
  propValues: { headline: "Hi" },
  outDir,
  driver: new FakeBrowserDriver(),
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(invalidResult.ok === false, "invalid doc fails before rendering");
if (!invalidResult.ok) {
  assert(invalidResult.errors.some((error) => error.stage === "validation"), "returns validation errors");
}

const failDriver = new FakeBrowserDriver();
const failResult = await renderComposition(templateDoc, {
  preset: "reels",
  propValues: { headline: "Hi" },
  outDir,
  driver: failDriver,
  ffmpegRunner: createFakeFfmpegRunner({ fail: true })
});
assert(failResult.ok === false, "ffmpeg failure yields ok:false");
if (!failResult.ok) {
  assert(failResult.errors.some((error) => error.code === "FFMPEG_FAILED"), "surfaces ffmpeg failure");
}
assertEqual(failDriver.closes, 1, "closes the browser driver even on ffmpeg failure");

const pngSequenceDoc: KavioDocument = {
  ...templateDoc,
  exports: [{ name: "frames", format: "png-sequence", width: 1080, height: 1920 }]
};
const unsupportedDriver = new FakeBrowserDriver();
const unsupportedResult = await renderComposition(pngSequenceDoc, {
  preset: "frames",
  propValues: { headline: "Frames" },
  outDir,
  driver: unsupportedDriver,
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(unsupportedResult.ok === false, "unsupported export formats fail before rendering");
if (!unsupportedResult.ok) {
  assert(
    unsupportedResult.errors.some((error) => error.message.includes("does not yet support png-sequence")),
    "unsupported export format returns a clear render error"
  );
}
assertEqual(unsupportedDriver.renderedFrames.length, 0, "unsupported export format does not capture frames");

const transparentDoc: KavioDocument = {
  ...templateDoc,
  exports: [{ name: "alpha-webm", format: "webm", width: 1080, height: 1920, background: "transparent" }]
};
const transparentDriver = new FakeBrowserDriver();
const transparentResult = await renderComposition(transparentDoc, {
  preset: "alpha-webm",
  propValues: { headline: "Alpha" },
  outDir,
  driver: transparentDriver,
  ffmpegRunner: createFakeFfmpegRunner()
});
assert(transparentResult.ok === false, "transparent final outputs fail before rendering");
if (!transparentResult.ok) {
  assert(
    transparentResult.errors.some((error) => error.message.includes("transparent final outputs")),
    "transparent output returns a clear render error"
  );
}
assertEqual(transparentDriver.renderedFrames.length, 0, "transparent output does not capture frames");

// --- render-batch.ts -------------------------------------------------------

const batchTemplate: KavioDocument = {
  ...templateDoc,
  exports: [
    { name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920 },
    { name: "square", format: "mp4", codec: "h264", width: 1080, height: 1080 }
  ]
};

const batchResults = await renderBatch(
  {
    template: batchTemplate,
    rows: [
      { id: "a", props: { headline: "A" } },
      { id: "b", props: { headline: "B" } }
    ],
    presets: ["reels", "square"]
  },
  { outDir, driver: new FakeBrowserDriver(), ffmpegRunner: createFakeFfmpegRunner() }
);
assertEqual(batchResults.length, 4, "batch expands rows x presets");
assert(
  batchResults.every((item) => item.result.ok),
  "all batch jobs succeed"
);
const batchPaths = batchResults.map((item) => (item.result.ok ? item.result.outputPath : ""));
assertEqual(new Set(batchPaths).size, 4, "batch produces distinct output paths");

const failFastResults = await renderBatch(
  {
    template: batchTemplate,
    rows: [
      { id: "a", props: { headline: "A" } },
      { id: "b", props: { headline: "B" } }
    ],
    presets: ["reels", "square"]
  },
  { outDir, driver: new FakeBrowserDriver(), ffmpegRunner: createFakeFfmpegRunner({ fail: true }), failFast: true }
);
assertEqual(failFastResults.length, 1, "fail-fast stops after the first failure");
assert(failFastResults[0]?.result.ok === false, "fail-fast records the failing job");

console.log("Render error helper self-checks passed.");
console.log("Render command assembly self-checks passed.");
console.log("Render harness server self-checks passed.");
console.log("Render ffmpeg runner self-checks passed.");
console.log("Render composition orchestrator self-checks passed.");
console.log("Render batch orchestrator self-checks passed.");
