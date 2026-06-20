import assert from "node:assert/strict";
import test from "node:test";
import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { FakeBrowserDriver, createFakeFfmpegRunner } from "../../render/dist/index.js";
import {
  inspectComposition,
  listExportPresets,
  migrateComposition,
  planRender,
  renderHandler,
  resolveProps,
  validateComposition
} from "../dist/handlers.js";

const valid = {
  version: "0.1",
  composition: { width: 1080, height: 1920, fps: 30, durationFrames: 30, background: "#000000" },
  assets: {},
  layers: [{ id: "t", type: "text", text: "hi", startFrame: 0, durationFrames: 30 }],
  audio: [],
  exports: [{ name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920 }]
};

test("validateComposition ok", () => {
  assert.equal(validateComposition({ document: valid }).ok, true);
});

test("validateComposition reports errors", () => {
  const r = validateComposition({ document: { ...valid, composition: { ...valid.composition, durationFrames: 0 } } });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 1);
});

test("validateComposition rejects malformed input", () => {
  const r = validateComposition({});
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, "MCP_INPUT_INVALID");
});

test("inspectComposition summary", () => {
  const r = inspectComposition({ document: valid });
  assert.equal(r.ok, true);
  assert.equal(r.data.layers.count, 1);
  assert.equal(r.data.tracks.count, 0);
  assert.equal(r.data.exports.names[0], "reels");
});

test("inspectComposition includes transition series overlap windows", () => {
  const document = {
    ...valid,
    composition: { ...valid.composition, durationFrames: 90 },
    layers: [
      { id: "scene-a", type: "text", text: "A", startFrame: 0, durationFrames: 60 },
      { id: "scene-b", type: "text", text: "B", startFrame: 48, durationFrames: 42 }
    ],
    tracks: [
      {
        id: "main",
        clips: [
          { id: "a", layerId: "scene-a", startFrame: 0, durationFrames: 60 },
          {
            id: "b",
            layerId: "scene-b",
            startFrame: 48,
            durationFrames: 42,
            transitionFromPrevious: {
              presentation: { type: "push", direction: "left" },
              timing: { type: "tween", durationFrames: 12, easing: "outCubic" }
            }
          }
        ]
      }
    ]
  };
  const r = inspectComposition({ document });
  assert.equal(r.ok, true);
  assert.equal(r.data.tracks.count, 1);
  assert.equal(r.data.tracks.clipCount, 2);
  assert.deepEqual(r.data.tracks.transitionWindows, [
    {
      trackId: "main",
      previousClipId: "a",
      previousLayerId: "scene-a",
      nextClipId: "b",
      nextLayerId: "scene-b",
      startFrame: 48,
      endFrame: 60,
      durationFrames: 12,
      transitionType: "push"
    }
  ]);
});

test("inspectComposition includes mask assets and procedural seeds", () => {
  const document = {
    ...valid,
    assets: {
      matte: { type: "image", src: "data:image/png;base64,mask" }
    },
    layers: [
      {
        id: "asset-mask",
        type: "shape",
        shape: "rect",
        startFrame: 0,
        durationFrames: 30,
        mask: {
          source: {
            kind: "asset",
            asset: "matte",
            mode: "alpha",
            resolution: { width: 320, height: 180 }
          }
        }
      },
      {
        id: "seeded-mask",
        type: "text",
        text: "Seed",
        startFrame: 0,
        durationFrames: 30,
        mask: {
          source: {
            kind: "procedural",
            type: "scanlines",
            seed: 42,
            resolution: { width: 640, height: 360 }
          },
          invert: true
        }
      }
    ]
  };
  const r = inspectComposition({ document });
  assert.equal(r.ok, true);
  assert.equal(r.data.masks.count, 2);
  assert.equal(r.data.masks.invertedCount, 1);
  assert.deepEqual(r.data.masks.assetMasks, [
    { layerId: "asset-mask", asset: "matte", mode: "alpha", width: 320, height: 180 }
  ]);
  assert.deepEqual(r.data.masks.proceduralMasks, [
    { layerId: "seeded-mask", type: "scanlines", seed: 42, width: 640, height: 360 }
  ]);
});

test("migrateComposition no-op", () => {
  const r = migrateComposition({ document: valid });
  assert.equal(r.ok, true);
  assert.equal(r.data.changed, false);
  assert.equal(r.data.toVersion, "0.1");
});

test("resolveProps resolves placeholders", () => {
  const doc = { ...valid, layers: [{ id: "t", type: "text", text: "{{h}}", startFrame: 0, durationFrames: 30 }] };
  const r = resolveProps({ document: doc, props: { h: "Hello" } });
  assert.equal(r.ok, true);
});

test("resolveProps reports unresolved props", () => {
  const doc = { ...valid, layers: [{ id: "t", type: "text", text: "{{missing}}", startFrame: 0, durationFrames: 30 }] };
  const r = resolveProps({ document: doc, props: {} });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 1);
});

test("listExportPresets returns presets", () => {
  const r = listExportPresets({});
  assert.equal(r.ok, true);
  const ids = r.data.map((preset) => preset.id);
  assert.deepEqual(ids, [
    "instagram-reels",
    "tiktok",
    "youtube-shorts",
    "facebook-reels",
    "instagram-feed-portrait",
    "square-feed",
    "landscape-feed"
  ]);
  assert.equal(r.data[0].preset.name, "instagram-reels-9x16");
});

test("planRender returns jobs with ffmpeg args", () => {
  const r = planRender({ document: valid, rows: [{ id: "a", props: {} }], presets: ["reels"] });
  assert.equal(r.ok, true);
  assert.equal(r.data.jobs.length, 1);
  assert.ok(r.data.jobs[0].ffmpegArgs.join(" ").includes("-filter_complex"));
  assert.ok(r.data.jobs[0].outputName.endsWith(".mp4"));
});

test("planRender expands rows x presets", () => {
  const r = planRender({
    document: { ...valid, exports: [
      { name: "reels", format: "mp4", codec: "h264", width: 1080, height: 1920 },
      { name: "square", format: "mp4", codec: "h264", width: 1080, height: 1080 }
    ] },
    rows: [{ id: "a", props: {} }, { id: "b", props: {} }],
    presets: ["reels", "square"]
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.jobs.length, 4);
});

test("planRender reports unknown preset", () => {
  const r = planRender({ document: valid, presets: ["bogus"] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 1);
});

test("renderHandler succeeds with injected fakes", async () => {
  const outDir = `mcp-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const r = await renderHandler(
    { document: valid, outDir },
    { driver: new FakeBrowserDriver(), ffmpegRunner: createFakeFfmpegRunner() }
  );
  assert.equal(r.ok, true);
  assert.ok(r.data.outputs.length >= 1);
  assert.equal(r.data.outputs[0].ok, true);
  assert.ok(r.data.outputs[0].outputPath.startsWith(resolve("renders") + "/"));
  await rm(dirname(r.data.outputs[0].outputPath), { recursive: true, force: true });
});

test("renderHandler rejects outDir escapes", async () => {
  const r = await renderHandler(
    { document: valid, outDir: "../outside" },
    { driver: new FakeBrowserDriver(), ffmpegRunner: createFakeFfmpegRunner() }
  );
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, "MCP_INPUT_INVALID");
  assert.match(r.errors[0].message, /renders directory/);
});

test("renderHandler surfaces failures as errors", async () => {
  const outDir = `mcp-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const r = await renderHandler(
    { document: valid, outDir },
    { driver: new FakeBrowserDriver(), ffmpegRunner: createFakeFfmpegRunner({ fail: true }) }
  );
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => ["BINARY_MISSING", "FFMPEG_FAILED", "RENDER_FAILED"].includes(e.code)));
  await rm(resolve("renders", outDir), { recursive: true, force: true });
});
