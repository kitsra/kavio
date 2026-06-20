// Gated end-to-end smoke test: real Playwright Chromium + bundled FFmpeg.
// Run only in the `render-e2e` CI job (or locally after
// `corepack pnpm run install:render-browsers` + an ffmpeg-static install). NOT
// part of the default `test` script.
//
// Follow-up: capture golden frames from a first real run and add SSIM
// comparison (committed under test/golden/). Until then this asserts the
// pipeline produces a well-formed MP4 of the expected dimensions/duration.

import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFfmpegRunner, PlaywrightDriver, renderComposition } from "../dist/index.js";

const composition = {
  version: "0.1",
  composition: { width: 320, height: 240, fps: 30, durationFrames: 6, background: "#102030" },
  assets: {},
  layers: [
    { id: "bg", type: "shape", shape: "rect", fill: "#102030", startFrame: 0, durationFrames: 6 },
    {
      id: "title",
      type: "text",
      text: "E2E",
      startFrame: 0,
      durationFrames: 6,
      position: { x: 160, y: 120 },
      anchor: "center",
      style: { fontFamily: "sans-serif", fontSize: 48, fontWeight: 800, color: "#ffffff", align: "center" }
    }
  ],
  audio: [],
  exports: [{ name: "e2e", format: "mp4", codec: "h264", width: 320, height: 240 }]
};

const outDir = await mkdtemp(join(tmpdir(), "kavio-e2e-"));
const result = await renderComposition(composition, {
  preset: "e2e",
  outDir,
  driver: new PlaywrightDriver(),
  ffmpegRunner: createFfmpegRunner()
});

assert.equal(result.ok, true, `render should succeed: ${result.ok ? "" : JSON.stringify(result.errors, null, 2)}`);

const info = await stat(result.outputPath);
assert.ok(info.size > 1000, `output mp4 should be non-trivial, got ${info.size} bytes`);
assert.equal(result.metadata.dimensions.width, 320, "metadata records output width");
assert.equal(result.metadata.dimensions.height, 240, "metadata records output height");
assert.equal(result.metadata.duration.frames, 6, "metadata records frame count");
assert.ok(result.metadata.checksums.length >= 1, "metadata records an output checksum");

console.log(`e2e render ok: ${result.outputPath} (${info.size} bytes)`);
