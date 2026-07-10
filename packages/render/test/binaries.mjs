import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveFfmpegDiagnostics, resolveFfmpegPath } from "../dist/binaries.js";

const originalPath = process.env.PATH;
const originalConfiguredPath = process.env.KAVIO_FFMPEG_PATH;
const dir = await mkdtemp(join(tmpdir(), "kavio-ffmpeg-test-"));

try {
  const explicit = join(dir, "ffmpeg-explicit");
  const system = join(dir, "ffmpeg");
  await writeFile(explicit, "#!/bin/sh\necho 'ffmpeg version 8.0.1-explicit test'\n");
  await writeFile(system, "#!/bin/sh\necho 'ffmpeg version 8.0.2-system test'\n");
  await chmod(explicit, 0o755);
  await chmod(system, 0o755);
  process.env.PATH = `${dir}:${originalPath ?? ""}`;

  process.env.KAVIO_FFMPEG_PATH = explicit;
  assert.equal(await resolveFfmpegPath(), explicit);
  assert.deepEqual(await resolveFfmpegDiagnostics(), {
    path: explicit,
    source: "environment",
    version: "8.0.1-explicit"
  });

  process.env.KAVIO_FFMPEG_PATH = join(dir, "missing");
  await assert.rejects(resolveFfmpegPath(), (error) => {
    assert.equal(error.code, "BINARY_MISSING");
    assert.match(error.hint, /Correct or unset KAVIO_FFMPEG_PATH/);
    return true;
  });

  delete process.env.KAVIO_FFMPEG_PATH;
  assert.deepEqual(await resolveFfmpegDiagnostics(), {
    path: system,
    source: "system",
    version: "8.0.2-system"
  });
} finally {
  if (originalConfiguredPath === undefined) {
    delete process.env.KAVIO_FFMPEG_PATH;
  } else {
    process.env.KAVIO_FFMPEG_PATH = originalConfiguredPath;
  }
  if (originalPath === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = originalPath;
  }
  await rm(dir, { recursive: true, force: true });
}

console.log("Render FFmpeg binary resolution checks passed.");
