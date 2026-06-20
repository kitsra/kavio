import assert from "node:assert/strict";
import test from "node:test";
import { resources } from "../dist/resources.js";
import { prompts } from "../dist/prompts.js";

test("schema resource is valid JSON describing composition", () => {
  const r = resources.find((x) => x.uri === "kavio://schema/0.1.json");
  assert.ok(r);
  const parsed = JSON.parse(r.read());
  assert.ok(parsed.properties?.version || parsed.$defs || parsed.type, "exposes the composition schema");
});

test("presets resource lists builder social presets", () => {
  const r = resources.find((x) => x.uri === "kavio://presets.json");
  const presets = JSON.parse(r.read());
  assert.equal(presets.length, 7);
  assert.deepEqual(
    presets.map((preset) => preset.id),
    [
      "instagram-reels",
      "tiktok",
      "youtube-shorts",
      "facebook-reels",
      "instagram-feed-portrait",
      "square-feed",
      "landscape-feed"
    ]
  );
});

test("basic example resource is a valid-looking composition", () => {
  const r = resources.find((x) => x.uri === "kavio://examples/basic.json");
  const doc = JSON.parse(r.read());
  assert.equal(doc.version, "0.1");
  assert.ok(Array.isArray(doc.layers));
});

test("enums resource is valid JSON", () => {
  const r = resources.find((x) => x.uri === "kavio://enums.json");
  assert.ok(JSON.parse(r.read()).layerType.length >= 1);
});

test("author prompt renders with a brief", () => {
  const p = prompts.find((x) => x.name === "author_kavio_video");
  assert.ok(p.render({ brief: "a 10s vertical promo" }).includes("10s vertical promo"));
});

test("repair prompt includes the error paths", () => {
  const p = prompts.find((x) => x.name === "repair_kavio_json");
  const text = p.render({ document: "{}", errors: JSON.stringify([{ code: "X", path: "layers[1].style.fontSize", message: "bad" }]) });
  assert.ok(text.includes("layers[1].style.fontSize"));
});

test("adapt prompt includes the platform", () => {
  const p = prompts.find((x) => x.name === "adapt_for_platform");
  assert.ok(p.render({ document: "{}", platform: "square" }).includes("square"));
});
