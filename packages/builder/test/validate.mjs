import assert from "node:assert/strict";

import { asset, crop, exportPreset, text, validate, video, videoLayer } from "../dist/index.js";

const composition = video({
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 60
})
  .add(
    text("headline", {
      text: "Hello from the builder",
      startFrame: 0,
      durationFrames: 60
    })
  )
  .exports(exportPreset.reels());

assert.deepEqual(composition.validate(), { ok: true, errors: [] });
assert.deepEqual(validate(composition), { ok: true, errors: [] });
assert.deepEqual(validate(composition.toJSON()), { ok: true, errors: [] });

const socialClip = asset.video("socialClip", "https://example.com/landscape.mp4");
const socialComposition = video({
  width: 1920,
  height: 1080,
  fps: 30,
  durationFrames: 120
})
  .assets(socialClip)
  .add(
    videoLayer("socialClipLayer", {
      asset: socialClip,
      startFrame: 0,
      durationFrames: 120,
      fit: "cover",
      crop: crop.subject({
        x: 0.35,
        y: 0.42,
        keyframes: [
          { frame: 0, x: 0.35, y: 0.42 },
          { frame: 80, x: 0.62, y: 0.44 }
        ],
        source: "manual"
      })
    })
  )
  .exports(...exportPreset.social({ landscape: false }));

const socialJson = socialComposition.toJSON();
assert.deepEqual(socialComposition.validate(), { ok: true, errors: [] });
assert.deepEqual(
  socialJson.exports.map((preset) => `${preset.name}:${preset.width}x${preset.height}`),
  [
    "instagram-reels-9x16:1080x1920",
    "tiktok-9x16:1080x1920",
    "youtube-shorts-9x16:1080x1920",
    "facebook-reels-9x16:1080x1920",
    "square-1x1:1080x1080",
    "portrait-4x5:1080x1350"
  ]
);
assert.equal(socialJson.layers[0]?.crop?.mode, "subject");

const clip = asset.video("clip", "https://example.com/clip.mp4");
const invalid = video({
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 30
})
  .assets(clip)
  .add(
    text("too-long", {
      text: "This layer exceeds the composition duration",
      startFrame: 0,
      durationFrames: 60
    })
  )
  .exports(exportPreset.reels());

const invalidResult = invalid.validate();
assert.equal(invalidResult.ok, false);
assert.equal(
  invalidResult.errors.some((error) => error.code === "SCHEMA_FRAME_RANGE_INVALID"),
  true
);
assert.equal(
  invalidResult.errors.every((error) => error.stage === "validation" && error.retryable === false),
  true
);

const documentTypeResult = validate(null);
assert.equal(documentTypeResult.ok, false);
assert.equal(documentTypeResult.errors[0]?.code, "SCHEMA_DOCUMENT_TYPE");
