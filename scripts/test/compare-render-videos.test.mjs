import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { parseArgs } from "../compare-render-videos.mjs";

const script = resolve("scripts/compare-render-videos.mjs");

test("validates gate arguments without running FFmpeg", () => {
  const parsed = parseArgs(["reference.mkv", "candidate.mkv", "--frame", "0", "--min-frame-ssim", "0.99"]);
  assert.deepEqual(parsed.frameSeconds, [0]);
  assert.throws(() => parseArgs(["a", "b", "--min-frame-psnr", "30"]), /require at least one --frame/);
  assert.throws(() => parseArgs(["a", "b", "--min-ssim", "1.01"]), /between -1 and 1/);
});

test("emits compact JSON and distinguishes passing and failing gates", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "kavio-video-gate-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const reference = join(directory, "reference.mkv");
  const candidate = join(directory, "candidate.mkv");

  makeFixture(reference, "testsrc2=size=64x64:rate=10:duration=1");
  makeFixture(candidate, "testsrc2=size=64x64:rate=10:duration=1,drawbox=x=0:y=0:w=16:h=16:color=white:t=fill:enable='gte(t,0.4)'");

  const pass = runGate(reference, candidate, ["--min-ssim", "0.8", "--min-psnr", "15", "--frame", "0.1", "--min-frame-ssim", "0.99", "--min-frame-psnr", "40"]);
  assert.equal(pass.status, 0, pass.stderr);
  assert.equal(pass.stdout.trim().split("\n").length, 1);
  assert.equal(JSON.parse(pass.stdout).passed, true);

  const fail = runGate(reference, candidate, [
    "--min-ssim", "1", "--min-psnr", "100",
    "--frame", "0.6", "--min-frame-ssim", "0.9999", "--min-frame-psnr", "60"
  ]);
  assert.equal(fail.status, 2, fail.stderr);
  const result = JSON.parse(fail.stdout);
  assert.equal(result.passed, false);
  assert.ok(result.failures.some(({ metric }) => metric === "video.ssimAll"));
  assert.ok(result.failures.some(({ metric }) => metric === "video.psnrAverageDb"));
  assert.ok(result.failures.some(({ metric }) => metric === "frame.ssim"));
  assert.match(fail.stderr, /Render comparison failed/);
});

function makeFixture(path, source) {
  execFileSync(process.env.FFMPEG ?? "ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", source, "-c:v", "ffv1", path]);
}

function runGate(reference, candidate, args) {
  return spawnSync(process.execPath, [script, reference, candidate, "--json", "-", ...args], { encoding: "utf8" });
}
