import assert from "node:assert/strict";
import test from "node:test";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBrowserDriver, createFakeFfmpegRunner } from "../../render/dist/index.js";
import { createCatalog } from "../dist/catalog.js";

const valid = {
  version: "0.1",
  composition: { width: 1080, height: 1920, fps: 30, durationFrames: 6, background: "#101820" },
  assets: {},
  layers: [{ id: "t", type: "text", text: "hi", startFrame: 0, durationFrames: 6 }],
  audio: [],
  exports: [{ name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920 }]
};

test("catalog has 7 tools, 5 resources, 3 prompts", () => {
  const c = createCatalog();
  assert.equal(c.tools.length, 7);
  assert.equal(c.resources.length, 5);
  assert.equal(c.prompts.length, 3);
  for (const t of c.tools) {
    assert.equal(typeof t.name, "string");
    assert.equal(typeof t.description, "string");
    assert.ok(t.inputSchema && typeof t.inputSchema === "object");
    assert.equal(typeof t.handler, "function");
  }
});

test("tool names are unique", () => {
  const names = createCatalog().tools.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
});

test("render tool uses injected deps", async () => {
  const outDir = `mcp-catalog-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const c = createCatalog({ render: { driver: new FakeBrowserDriver(), ffmpegRunner: createFakeFfmpegRunner() } });
  const tool = c.tools.find((t) => t.name === "render");
  const r = await tool.handler({ document: valid, outDir });
  assert.equal(r.ok, true);
  await rm(resolve("renders", outDir), { recursive: true, force: true });
});
