import assert from "node:assert/strict";
import test from "node:test";

import { fixturePath, runCli, spawnCli, waitForStdout } from "./helpers/run-cli.mjs";

test("prints help for the default command", async () => {
  const result = await runCli([]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Kavio CLI/);
  assert.match(result.stdout, /kavio \[--json\] validate <file>/);
  assert.match(result.stdout, /kavio \[--json\] preview <file>/);
  assert.match(result.stdout, /kavio \[--json\] presets \[preset-id\]/);
  assert.match(result.stdout, /inspect\s+Print a composition summary/);
  assert.match(result.stdout, /presets\s+List social media export presets/);
  assert.match(result.stdout, /preview\s+Start a local browser preview server/);
  assert.equal(result.stderr, "");
});

test("validates a valid composition", async () => {
  const validFile = fixturePath("valid-composition.json");
  const result = await runCli(["validate", validFile]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, new RegExp(`Valid Kavio composition: ${escapeRegExp(validFile)}`));
  assert.equal(result.stderr, "");
});

test("returns validation errors for an invalid composition", async () => {
  const result = await runCli(["validate", fixturePath("invalid-composition.json")]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Invalid Kavio composition/);
  assert.match(result.stderr, /\[PROP_TYPE_MISMATCH\]/);
  assert.match(result.stderr, /\[SCHEMA_ASSET_TYPE_MISMATCH\]/);
  assert.match(result.stderr, /\[PROP_UNDECLARED_PLACEHOLDER\]/);
});

test("emits JSON validation success and failure payloads", async () => {
  const validFile = fixturePath("valid-composition.json");
  const validResult = await runCli(["--json", "validate", validFile]);

  assert.equal(validResult.status, 0);
  assert.equal(validResult.stderr, "");
  assert.deepEqual(JSON.parse(validResult.stdout), {
    command: "validate",
    ok: true,
    file: validFile,
    version: "0.1",
    errors: []
  });

  const invalidResult = await runCli(["validate", fixturePath("invalid-composition.json"), "--json"]);
  const invalidPayload = JSON.parse(invalidResult.stdout);

  assert.equal(invalidResult.status, 1);
  assert.equal(invalidResult.stderr, "");
  assert.equal(invalidPayload.command, "validate");
  assert.equal(invalidPayload.ok, false);
  assert.equal(invalidPayload.version, "0.1");
  assert.ok(invalidPayload.errors.some((error) => error.code === "SCHEMA_FRAME_RANGE_INVALID"));
});

test("inspects a valid composition in text and JSON modes", async () => {
  const validFile = fixturePath("valid-composition.json");
  const textResult = await runCli(["inspect", validFile]);

  assert.equal(textResult.status, 0);
  assert.match(textResult.stdout, /Kavio composition:/);
  assert.match(textResult.stdout, /Size: 1080x1920 @ 30fps/);
  assert.match(textResult.stdout, /Duration: 90 frames \(3\.00s\)/);
  assert.match(textResult.stdout, /Assets: 2 \(video: 1, image: 1\)/);
  assert.match(textResult.stdout, /Layers: 2 \(video: 1, text: 1\)/);
  assert.match(textResult.stdout, /  - social/);
  assert.equal(textResult.stderr, "");

  const jsonResult = await runCli(["--json", "inspect", validFile]);
  const payload = JSON.parse(jsonResult.stdout);

  assert.equal(jsonResult.status, 0);
  assert.equal(jsonResult.stderr, "");
  assert.equal(payload.command, "inspect");
  assert.equal(payload.ok, true);
  assert.equal(payload.summary.file, validFile);
  assert.equal(payload.summary.composition.durationSeconds, 3);
  assert.deepEqual(payload.summary.exports.names, ["social"]);
});

test("lists social media presets and prints pasteable preset JSON", async () => {
  const listResult = await runCli(["presets"]);

  assert.equal(listResult.status, 0);
  assert.match(listResult.stdout, /instagram-reels\s+Instagram Reels\s+1080x1920/);
  assert.match(listResult.stdout, /tiktok\s+TikTok\s+1080x1920/);
  assert.match(listResult.stdout, /youtube-shorts\s+YouTube Shorts\s+1080x1920/);
  assert.equal(listResult.stderr, "");

  const presetResult = await runCli(["presets", "youtube-shorts"]);
  assert.equal(presetResult.status, 0);
  assert.equal(presetResult.stderr, "");
  assert.deepEqual(JSON.parse(presetResult.stdout), {
    name: "youtube-shorts-9x16",
    format: "mp4",
    codec: "h264",
    width: 1080,
    height: 1920
  });

  const jsonResult = await runCli(["--json", "presets", "instagram-reels"]);
  const payload = JSON.parse(jsonResult.stdout);
  assert.equal(jsonResult.status, 0);
  assert.equal(payload.command, "presets");
  assert.equal(payload.ok, true);
  assert.equal(payload.preset.id, "instagram-reels");
  assert.equal(payload.preset.preset.name, "instagram-reels-9x16");
});

test("migrates the current schema as a no-op", async () => {
  const validFile = fixturePath("valid-composition.json");
  const textResult = await runCli(["migrate", validFile]);
  const migratedDocument = JSON.parse(textResult.stdout);

  assert.equal(textResult.status, 0);
  assert.match(textResult.stderr, /No migration needed:/);
  assert.equal(migratedDocument.version, "0.1");
  assert.equal(migratedDocument.composition.durationFrames, 90);

  const jsonResult = await runCli(["migrate", validFile, "--json"]);
  const payload = JSON.parse(jsonResult.stdout);

  assert.equal(jsonResult.status, 0);
  assert.equal(jsonResult.stderr, "");
  assert.equal(payload.command, "migrate");
  assert.equal(payload.ok, true);
  assert.equal(payload.changed, false);
  assert.equal(payload.fromVersion, "0.1");
  assert.equal(payload.toVersion, "0.1");
  assert.deepEqual(payload.document, migratedDocument);
});

test("starts a local preview server for a valid composition", async (t) => {
  const validFile = fixturePath("valid-composition.json");
  const preview = spawnCli(["preview", validFile]);
  t.after(() => {
    if (preview.exitCode === null) {
      preview.kill("SIGTERM");
    }
  });

  const match = await waitForStdout(preview, /Kavio preview: (http:\/\/127\.0\.0\.1:\d+\/)/);
  const url = match[1];
  const shellResponse = await fetch(url);
  const shell = await shellResponse.text();

  assert.equal(shellResponse.status, 200);
  assert.match(shell, /Kavio Preview/);
  assert.match(shell, /Preview shell ready/);
  assert.match(preview.stdoutText, /Renderer: /);

  const compositionResponse = await fetch(new URL("/composition.json", url));
  const composition = await compositionResponse.json();

  assert.equal(compositionResponse.status, 200);
  assert.equal(composition.version, "0.1");
  assert.equal(composition.composition.durationFrames, 90);

  const closed = new Promise((resolveClose) => {
    preview.once("close", resolveClose);
  });
  preview.kill("SIGTERM");
  await closed;
});

test("emits JSON command failures when --json is requested", async () => {
  const result = await runCli(["--json", "validate"]);
  const payload = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  assert.deepEqual(payload, {
    command: "validate",
    ok: false,
    errors: [
      {
        code: "CLI_FILE_REQUIRED",
        severity: "error",
        message: "Missing file argument for kavio validate.",
        path: "",
        stage: "io",
        retryable: false,
        hint: "Usage: kavio validate <file>"
      }
    ]
  });
});

test("render requires a file argument", async () => {
  const { status, stdout } = await runCli(["--json", "render"]);
  assert.notEqual(status, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.errors[0].code, "CLI_FILE_REQUIRED");
});

test("render reports per-job errors for an invalid composition", async () => {
  const { status, stdout } = await runCli(["--json", "render", fixturePath("invalid-composition.json")]);
  assert.notEqual(status, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.command, "render");
  assert.equal(payload.ok, false);
  assert.ok(payload.outputs.length >= 1);
  assert.equal(payload.outputs[0].ok, false);
  assert.ok(payload.outputs[0].errors.length >= 1);
});

test("render fails fast on an unknown export preset", async () => {
  const { status, stdout } = await runCli([
    "--json",
    "render",
    fixturePath("valid-composition.json"),
    "--export",
    "bogus"
  ]);
  assert.notEqual(status, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.errors[0].code, "CLI_RENDER_FAILED");
});

test("render rejects a missing flag value", async () => {
  const { status, stdout } = await runCli([
    "--json",
    "render",
    fixturePath("valid-composition.json"),
    "--export"
  ]);
  assert.notEqual(status, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.errors[0].code, "CLI_UNKNOWN_FLAG");
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
