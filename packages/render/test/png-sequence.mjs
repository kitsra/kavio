import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createFakeFfmpegRunner, FakeBrowserDriver, renderComposition } from "../dist/index.js";

const doc = {
  version: "0.1",
  composition: { width: 320, height: 180, fps: 30, durationFrames: 3, background: "#101820" },
  assets: {},
  layers: [{ id: "bg", type: "shape", shape: "rect", fill: "#101820", startFrame: 0, durationFrames: 3 }],
  audio: [],
  exports: [{ name: "frames", format: "png-sequence", width: 320, height: 180 }]
};

const outDir = await mkdtemp(join(tmpdir(), "kavio-png-sequence-"));
try {
  const driver = new FakeBrowserDriver();
  const runner = createFakeFfmpegRunner();
  const result = await renderComposition(doc, { preset: "frames", outDir, driver, ffmpegRunner: runner });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  assert.equal(result.outputPath, join(outDir, "frames"));
  assert.equal(result.outputPattern, join(outDir, "frames", "frame-%05d.png"));
  assert.deepEqual((await readdir(result.outputPath)).sort(), ["frame-00000.png", "frame-00001.png", "frame-00002.png"]);
  assert.deepEqual([...await readFile(join(result.outputPath, "frame-00002.png"))], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(result.metadata.output.path, result.outputPath);
  assert.equal(result.metadata.codecs.video, null);
  assert.equal(result.metadata.codecs.audio, null);
  assert.equal(result.metadata.checksums[0]?.bytes, 24);
  assert.equal(result.metadata.tools.ffmpeg.version, "not-used");
  assert.equal(result.timings.encodeMs, 0);
  assert.equal(driver.renderedFrames.length, 3);
  assert.equal(runner.calls.length, 0);

  const unsafe = await renderComposition(doc, {
    preset: "frames",
    outDir,
    outputName: "nested/frames",
    driver: new FakeBrowserDriver(),
    ffmpegRunner: createFakeFfmpegRunner()
  });
  assert.equal(unsafe.ok, false);
  if (!unsafe.ok) assert.equal(unsafe.errors[0]?.path, "outputName");

  await mkdir(join(outDir, "existing"));
  const existing = await renderComposition(doc, {
    preset: "frames",
    outDir,
    outputName: "existing",
    driver: new FakeBrowserDriver(),
    ffmpegRunner: createFakeFfmpegRunner()
  });
  assert.equal(existing.ok, false);
  if (!existing.ok) assert.match(existing.errors[0]?.message ?? "", /already exists/u);

  const incomplete = await renderComposition(doc, {
    preset: "frames",
    outDir,
    outputName: "incomplete",
    continueOnFrameError: true,
    driver: new FakeBrowserDriver(),
    ffmpegRunner: createFakeFfmpegRunner()
  });
  assert.equal(incomplete.ok, false);
  if (!incomplete.ok) assert.equal(incomplete.errors[0]?.path, "continueOnFrameError");

  class FailingDriver extends FakeBrowserDriver {
    async renderFrame(frame, options) {
      if (frame === 1) throw new Error("capture failed");
      return super.renderFrame(frame, options);
    }
  }
  const failed = await renderComposition(doc, {
    preset: "frames",
    outDir,
    outputName: "failed",
    captureParallelism: 1,
    driver: new FailingDriver(),
    ffmpegRunner: createFakeFfmpegRunner()
  });
  assert.equal(failed.ok, false);
  await assert.rejects(access(join(outDir, "failed")));
} finally {
  await rm(outDir, { recursive: true, force: true });
}

console.log("png-sequence render ok");
