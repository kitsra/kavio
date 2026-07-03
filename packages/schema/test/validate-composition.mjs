import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { migrateComposition, migrateComposition01To01, validateComposition } from "../dist/index.js";

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const repositoryRoot = join(fixtureRoot, "../../../..");

async function readFixture(name) {
  return JSON.parse(await readFile(join(fixtureRoot, name), "utf8"));
}

const validComposition = await readFixture("valid-basic.json");
const validMasksComposition = await readFixture("valid-masks.json");
const nativeTransitionsExample = JSON.parse(
  await readFile(join(repositoryRoot, "examples/native-transitions/composition.json"), "utf8")
);

assert.deepEqual(validateComposition(validComposition), { ok: true, errors: [] });
assert.deepEqual(validateComposition(validMasksComposition), { ok: true, errors: [] });
assert.deepEqual(validateComposition(nativeTransitionsExample), { ok: true, errors: [] });
assert.equal(migrateComposition01To01(validComposition), validComposition);
assert.equal(migrateComposition(validComposition), validComposition);
assert.equal(migrateComposition(validComposition, { fromVersion: "0.1", toVersion: "0.1" }), validComposition);

const timedComposition = structuredClone(validComposition);
timedComposition.layers[1].keyframes = {
  opacity: [
    { frame: 0, value: 0, timing: { type: "steps", steps: 4, direction: "end" } },
    { frame: 12, value: 1 }
  ]
};
timedComposition.layers[1].transitionIn = {
  type: "fade",
  timing: {
    type: "sequence",
    segments: [
      { durationFrames: 3, from: 0, to: -0.08, timing: { type: "tween", easing: "anticipate" } },
      { durationFrames: 9, from: -0.08, to: 1, timing: { type: "spring", damping: 12, stiffness: 120, mass: 1 } }
    ]
  }
};
timedComposition.layers[1].transitionOut = {
  type: "slide",
  direction: "up",
  durationFrames: 12,
  timing: {
    type: "stagger",
    childCount: 3,
    childIndex: 1,
    eachFrames: 2,
    timing: { type: "tween", durationFrames: 6, easing: "outCirc" }
  }
};
assert.deepEqual(validateComposition(timedComposition), { ok: true, errors: [] });

const invalidTimingComposition = structuredClone(validComposition);
invalidTimingComposition.layers[1].transitionIn = {
  type: "fade",
  durationFrames: 8,
  timing: { type: "stagger", childCount: 2, childIndex: 2, eachFrames: 1, timing: { type: "steps", steps: 0 } }
};
const invalidTimingResult = validateComposition(invalidTimingComposition);
assert.equal(invalidTimingResult.ok, false);
assert.deepEqual(
  invalidTimingResult.errors.map(({ code, path }) => ({ code, path })),
  [
    { code: "SCHEMA_INVALID_FIELD", path: "layers[1].transitionIn.timing.timing.steps" },
    { code: "SCHEMA_INVALID_TIMING", path: "layers[1].transitionIn.timing.childIndex" }
  ]
);

const missingTimingDurationComposition = structuredClone(validComposition);
missingTimingDurationComposition.layers[1].transitionIn = {
  type: "fade",
  timing: { type: "spring", stiffness: 120, damping: 12 }
};
const missingTimingDurationResult = validateComposition(missingTimingDurationComposition);
assert.equal(missingTimingDurationResult.ok, false);
assert.deepEqual(
  missingTimingDurationResult.errors.map(({ code, path }) => ({ code, path })),
  [{ code: "SCHEMA_REQUIRED_FIELD", path: "layers[1].transitionIn.durationFrames" }]
);

const transitionSeriesComposition = structuredClone(validComposition);
transitionSeriesComposition.composition.durationFrames = 90;
transitionSeriesComposition.layers = [
  { id: "scene-a", type: "text", text: "A", startFrame: 0, durationFrames: 60 },
  { id: "scene-b", type: "text", text: "B", startFrame: 48, durationFrames: 42 }
];
transitionSeriesComposition.tracks = [
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
];
assert.deepEqual(validateComposition(transitionSeriesComposition), { ok: true, errors: [] });

const invalidTransitionSeries = structuredClone(transitionSeriesComposition);
invalidTransitionSeries.tracks[0].clips[1].startFrame = 55;
const invalidTransitionSeriesResult = validateComposition(invalidTransitionSeries);
assert.equal(invalidTransitionSeriesResult.ok, false);
assert.ok(
  invalidTransitionSeriesResult.errors.some(
    (error) => error.code === "TRANSITION_SERIES_OVERLAP_INVALID" && error.path === "tracks[0].clips[1].transitionFromPrevious"
  )
);

const invalidComposition = await readFixture("invalid-validation.json");
const invalidResult = validateComposition(invalidComposition);
assert.equal(invalidResult.ok, false);

assert.deepEqual(
  invalidResult.errors.map(({ code, path }) => ({ code, path })),
  [
    { code: "PROP_TYPE_MISMATCH", path: "props.headline.default" },
    { code: "SCHEMA_ASSET_TYPE_MISMATCH", path: "layers[0].asset" },
    { code: "SCHEMA_FRAME_RANGE_INVALID", path: "layers[0]" },
    { code: "SCHEMA_DUPLICATE_LAYER_ID", path: "layers[1].id" },
    { code: "SCHEMA_UNKNOWN_ASSET_REFERENCE", path: "layers[1].asset" },
    { code: "SCHEMA_KEYFRAME_VALUE_TYPE", path: "layers[1].keyframes.opacity[1].value" },
    { code: "SCHEMA_INVALID_EASING", path: "layers[1].keyframes.opacity[1].easing" },
    { code: "SCHEMA_KEYFRAMES_UNSORTED", path: "layers[1].keyframes.opacity[1].frame" },
    { code: "SCHEMA_UNSUPPORTED_MASK_SOURCE", path: "layers[1].mask.source.type" },
    { code: "SCHEMA_REQUIRED_FIELD", path: "layers[1].mask.source.seed" },
    { code: "SCHEMA_INVALID_FIELD", path: "layers[2].style.fontSize" },
    { code: "SCHEMA_REQUIRED_FIELD", path: "layers[2].transitionIn.durationFrames" },
    { code: "SCHEMA_INVALID_FIELD", path: "layers[2].transitionIn.direction" },
    { code: "SCHEMA_INVALID_EASING", path: "layers[2].transitionIn.easing" },
    { code: "SCHEMA_INVALID_FIELD", path: "exports[0].width" },
    { code: "SCHEMA_UNSUPPORTED_EXPORT_CODEC", path: "exports[0].codec" },
    { code: "PROP_UNDECLARED_PLACEHOLDER", path: "layers[2].text" }
  ]
);

assert.equal(
  invalidResult.errors.every((error) => error.stage === "validation" && error.retryable === false),
  true
);

// --- png image exports -------------------------------------------------------

const pngComposition = structuredClone(validComposition);
pngComposition.exports = [
  { name: "card", format: "png", width: 1080, height: 1080, frame: 12 },
  { name: "sticker", format: "png", width: 512, height: 512, background: "transparent" }
];
assert.deepEqual(validateComposition(pngComposition), { ok: true, errors: [] }, "png exports validate");

const pngBadFrame = structuredClone(pngComposition);
pngBadFrame.exports[0].frame = -1;
assert.equal(validateComposition(pngBadFrame).ok, false, "negative export frame is rejected");

const pngFrameOutOfRange = structuredClone(pngComposition);
pngFrameOutOfRange.exports[0].frame = 60;
assert.equal(validateComposition(pngFrameOutOfRange).ok, false, "export frame beyond duration is rejected");

const pngWithCodec = structuredClone(pngComposition);
pngWithCodec.exports[0].codec = "h264";
assert.equal(validateComposition(pngWithCodec).ok, false, "png exports reject video codecs");

const frameOnVideoExport = structuredClone(validComposition);
frameOnVideoExport.exports = [{ name: "reel", format: "mp4", codec: "h264", width: 1080, height: 1920, frame: 3 }];
assert.equal(validateComposition(frameOnVideoExport).ok, false, "frame field is only valid for png exports");

console.log("Schema png export self-checks passed.");
