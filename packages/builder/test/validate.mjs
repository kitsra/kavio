import assert from "node:assert/strict";

import {
  asset,
  camera,
  cinematic,
  crop,
  easing,
  effect,
  exportPreset,
  image,
  keyframes,
  presetNamespaces,
  text,
  timing,
  textMotion,
  track,
  trackClip,
  transition,
  transitionSeries,
  validate,
  video,
  videoLayer
} from "../dist/index.js";

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
      durationFrames: 60,
      transitionIn: transition.fade({ durationFrames: 8 })
    }).exit(transition.slide({ direction: "up", durationFrames: 8, easing: "inCubic" }))
  )
  .exports(exportPreset.reels());

assert.deepEqual(composition.validate(), { ok: true, errors: [] });
assert.deepEqual(validate(composition), { ok: true, errors: [] });
assert.deepEqual(validate(composition.toJSON()), { ok: true, errors: [] });
assert.deepEqual(composition.toJSON().layers[0]?.transitionIn, { type: "fade", durationFrames: 8 });
assert.deepEqual(composition.toJSON().layers[0]?.transitionOut, {
  type: "slide",
  durationFrames: 8,
  direction: "up",
  easing: "inCubic"
});

const timingComposition = video({
  width: 1080,
  height: 1080,
  fps: 30,
  durationFrames: 30
})
  .add(
    text("timed-headline", {
      text: "Timing",
      startFrame: 0,
      durationFrames: 30,
      transitionIn: transition.fade({
        timing: timing.sequence([
          { durationFrames: 4, from: 0, to: -0.1, timing: timing.tween({ easing: easing.anticipate }) },
          { durationFrames: 8, from: -0.1, to: 1, timing: timing.spring({ damping: 12, stiffness: 120 }) }
        ])
      }),
      keyframes: {
        opacity: keyframes([
          { frame: 0, value: 0, timing: timing.steps({ steps: 3 }) },
          { frame: 12, value: 1 }
        ])
      }
    }).exit(
      transition.slide({
        direction: "up",
        durationFrames: 12,
        timing: timing.stagger({
          childCount: 3,
          childIndex: 1,
          eachFrames: 2,
          timing: timing.tween({ durationFrames: 6, easing: easing.outCirc })
        })
      })
    )
  )
  .exports(exportPreset.square());

assert.deepEqual(timingComposition.validate(), { ok: true, errors: [] });
assert.deepEqual(timingComposition.toJSON().layers[0]?.transitionIn, {
  type: "fade",
  timing: {
    type: "sequence",
    segments: [
      { durationFrames: 4, from: 0, to: -0.1, timing: { type: "tween", easing: "anticipate" } },
      { durationFrames: 8, from: -0.1, to: 1, timing: { type: "spring", stiffness: 120, damping: 12 } }
    ]
  }
});
assert.throws(() => timing.sequence([]), /sequence timing requires/);
assert.throws(() => timing.stagger({ childCount: 2, childIndex: 2, eachFrames: 1, timing: timing.tween() }), /childIndex/);

const expandedTransitions = [
  transition.zoom({ durationFrames: 10, amount: 0.18 }),
  transition.push({ direction: "left", durationFrames: 10 }),
  transition.spin({ durationFrames: 10, amount: 180 }),
  transition.rotate({ durationFrames: 10 }),
  transition.flip({ axis: "y", durationFrames: 10 }),
  transition.blurDissolve({ durationFrames: 10, amount: 18 }),
  transition.colorDissolve({ durationFrames: 10, color: "#ffffff" }),
  transition.dip({ durationFrames: 10, color: "#000000" }),
  transition.iris({ durationFrames: 10, shape: "circle" }),
  transition.stretch({ durationFrames: 10, axis: "x" }),
  transition.squeeze({ durationFrames: 10, axis: "y" }),
  transition.clockWipe({ durationFrames: 10, direction: "right" }),
  transition.barWipe({ durationFrames: 10, direction: "right", columns: 8 }),
  transition.gridWipe({ durationFrames: 10, direction: "down", rows: 3, columns: 5 }),
  transition.tileReveal({ durationFrames: 10, rows: 3, columns: 5 }),
  transition.radialBlur({ durationFrames: 10, amount: 18, intensity: 0.04 }),
  transition.zoomBlur({ durationFrames: 10, amount: 18, intensity: 0.14 }),
  transition.bookFlip({ durationFrames: 10, axis: "y" }),
  transition.pageCurlLite({ durationFrames: 10, direction: "left", intensity: 10 }),
  transition.skewSlide({ durationFrames: 10, direction: "up", intensity: 12 }),
  transition.expandMask({ durationFrames: 10, shape: "circle" }),
  transition.letterboxReveal({ durationFrames: 10, axis: "y" }),
  transition.filmFlash({ durationFrames: 6, color: "#fff7dd" }),
  transition.cameraWhip({ durationFrames: 8, direction: "left", amount: 14, intensity: 10 })
];
assert.deepEqual(
  expandedTransitions.map((definition) => definition.type),
  [
    "zoom",
    "push",
    "spin",
    "rotate",
    "flip",
    "blurDissolve",
    "colorDissolve",
    "dip",
    "iris",
    "stretch",
    "squeeze",
    "clockWipe",
    "barWipe",
    "gridWipe",
    "tileReveal",
    "radialBlur",
    "zoomBlur",
    "bookFlip",
    "pageCurlLite",
    "skewSlide",
    "expandMask",
    "letterboxReveal",
    "filmFlash",
    "cameraWhip"
  ]
);
assert.equal(presetNamespaces.transition, transition);
assert.equal(presetNamespaces.camera, camera);
assert.equal(presetNamespaces.cinematic, cinematic);
assert.equal(presetNamespaces.textMotion, textMotion);
assert.equal(presetNamespaces.effect, effect);

const still = asset.image("still", "https://example.com/still.jpg");
const cameraComposition = video({
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 90
})
  .assets(still)
  .add(
    image("camera-still", {
      asset: still,
      startFrame: 0,
      durationFrames: 90,
      position: { x: 540, y: 960 },
      anchor: "center",
      size: { width: 1080, height: 1920 },
      fit: "cover",
      keyframes: camera.kenBurns({
        durationFrames: 90,
        direction: "right",
        restingX: 540,
        safeArea: 0.1,
        easing: "inOutCubic"
      })
    }).motion(camera.pushIn({ durationFrames: 90, intensity: 0.04 }))
  )
  .exports(exportPreset.reels());

const cameraJson = cameraComposition.toJSON();
assert.deepEqual(cameraComposition.validate(), { ok: true, errors: [] });
assert.deepEqual(camera.pushIn({ durationFrames: 4 }), {
  scale: [
    { frame: 0, value: 1 },
    { frame: 3, value: 1.08 }
  ]
});
assert.deepEqual(camera.pullBack({ durationFrames: 4, intensity: 0.2 }), {
  scale: [
    { frame: 0, value: 1.2 },
    { frame: 3, value: 1 }
  ]
});
assert.deepEqual(camera.pan({ durationFrames: 5, restingX: 100, amount: 40, direction: "left", scale: 1 }), {
  x: [
    { frame: 0, value: 120 },
    { frame: 4, value: 80 }
  ]
});
assert.deepEqual(camera.tilt({ durationFrames: 5, restingY: 200, amount: 40, direction: "down", scale: 1 }), {
  y: [
    { frame: 0, value: 180 },
    { frame: 4, value: 220 }
  ]
});
assert.deepEqual(cameraJson.layers[0]?.keyframes?.scale, [
  { frame: 0, value: 1 },
  { frame: 89, value: 1.04 }
]);
assert.deepEqual(cameraJson.layers[0]?.keyframes?.x, [
  { frame: 0, value: 525.6, easing: "inOutCubic" },
  { frame: 89, value: 554.4 }
]);

assert.deepEqual(camera.parallax({ durationFrames: 5, direction: "right", restingX: 100, amount: 20, fromScale: 1, toScale: 1.04 }), {
  scale: [
    { frame: 0, value: 1 },
    { frame: 4, value: 1.04 }
  ],
  x: [
    { frame: 0, value: 90 },
    { frame: 4, value: 110 }
  ]
});
assert.deepEqual(camera.orbitLite({ durationFrames: 7, restingX: 100, restingY: 200, amount: 30, verticalAmount: 12, direction: "left" }), {
  x: [
    { frame: 0, value: 115 },
    { frame: 3, value: 100 },
    { frame: 6, value: 85 }
  ],
  scale: [
    { frame: 0, value: 1.02 },
    { frame: 3, value: 1.05 },
    { frame: 6, value: 1.02 }
  ],
  rotation: [
    { frame: 0, value: 1.8 },
    { frame: 6, value: -1.8 }
  ],
  y: [
    { frame: 0, value: 206 },
    { frame: 3, value: 194 },
    { frame: 6, value: 206 }
  ]
});
assert.deepEqual(camera.handheld({ durationFrames: 13, seed: 7, restingX: 100, restingY: 200, amount: 4, rotationAmount: 0.5, intervalFrames: 6 }), {
  x: [
    { frame: 0, value: 96, easing: "inOutQuad" },
    { frame: 6, value: 103.366, easing: "inOutQuad" },
    { frame: 12, value: 98.314 }
  ],
  y: [
    { frame: 0, value: 197.404, easing: "inOutQuad" },
    { frame: 6, value: 198.472, easing: "inOutQuad" },
    { frame: 12, value: 200.548 }
  ],
  rotation: [
    { frame: 0, value: -0.498, easing: "inOutQuad" },
    { frame: 6, value: 0.175, easing: "inOutQuad" },
    { frame: 12, value: 0.222 }
  ],
  scale: [
    { frame: 0, value: 1.02 },
    { frame: 12, value: 1.02 }
  ]
});
assert.deepEqual(camera.crashZoom({ durationFrames: 8, direction: "in", intensity: 0.25 }), {
  scale: [
    { frame: 0, value: 1, easing: "outCubic" },
    { frame: 2, value: 1.3, easing: "outBack" },
    { frame: 7, value: 1.25 }
  ]
});
assert.deepEqual(camera.dollyZoomLite({ durationFrames: 5, direction: "out", subjectAnchor: "right", restingX: 100, amount: 20 }), {
  scale: [
    { frame: 0, value: 1.12 },
    { frame: 4, value: 1 }
  ],
  x: [
    { frame: 0, value: 80 },
    { frame: 4, value: 120 }
  ]
});

const advancedCameraComposition = video({
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 90
})
  .assets(still)
  .add(
    image("parallax-still", {
      asset: still,
      startFrame: 0,
      durationFrames: 90,
      fit: "cover",
      keyframes: camera.parallax({ durationFrames: 90, direction: "left", safeArea: 0.12 })
    }),
    image("orbit-still", {
      asset: still,
      startFrame: 0,
      durationFrames: 90,
      fit: "cover",
      keyframes: camera.orbitLite({ durationFrames: 90, direction: "right", intensity: 0.08 })
    }),
    image("handheld-still", {
      asset: still,
      startFrame: 0,
      durationFrames: 90,
      fit: "cover",
      keyframes: camera.handheld({ durationFrames: 90, seed: 42, intensity: 0.04 })
    }),
    image("crash-still", {
      asset: still,
      startFrame: 0,
      durationFrames: 30,
      fit: "cover",
      keyframes: camera.crashZoom({ durationFrames: 30 })
    }),
    image("dolly-still", {
      asset: still,
      startFrame: 30,
      durationFrames: 60,
      fit: "cover",
      keyframes: camera.dollyZoomLite({ durationFrames: 60, subjectAnchor: { x: 0.7, y: 0.42 } })
    })
  )
  .exports(exportPreset.reels());

assert.deepEqual(advancedCameraComposition.validate(), { ok: true, errors: [] });

const motionComposition = video({
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 72
})
  .add(
    text("rise-headline", {
      text: "Rise headline",
      startFrame: 0,
      durationFrames: 48,
      ...textMotion.rise({ durationFrames: 16 })
    }),
    text("blur-headline", {
      text: "Blur headline",
      startFrame: 20,
      durationFrames: 40,
      ...textMotion.blurIn({ durationFrames: 10, amount: 18 })
    }),
    text("instant-headline", {
      text: "Instant headline",
      startFrame: 64,
      durationFrames: 1,
      ...textMotion.rise({ durationFrames: 1 })
    }),
    text("type-headline", {
      text: "Type headline",
      startFrame: 0,
      durationFrames: 48,
      ...textMotion.typeOn({ durationFrames: 18, split: "char", staggerFrames: 1 })
    }),
    text("cascade-headline", {
      text: "Cascade headline",
      startFrame: 0,
      durationFrames: 48,
      ...textMotion.cascade({ durationFrames: 12, split: "word", staggerFrames: 2, direction: "up" })
    }),
    text("scramble-headline", {
      text: "Scramble",
      startFrame: 0,
      durationFrames: 48,
      ...textMotion.scramble({ durationFrames: 10, seed: 42 })
    }),
    text("highlight-headline", {
      text: "Highlight sweep",
      startFrame: 0,
      durationFrames: 48,
      ...textMotion.highlightSweep({ durationFrames: 16, color: "#facc15" })
    }),
    text("tracking-headline", {
      text: "Tracking",
      startFrame: 0,
      durationFrames: 48,
      ...textMotion.trackingIn({ durationFrames: 14, amount: 10, origin: "center" })
    })
  )
  .exports(exportPreset.reels());

const motionJson = motionComposition.toJSON();
assert.deepEqual(motionComposition.validate(), { ok: true, errors: [] });
assert.deepEqual(motionJson.layers[0]?.transitionIn, {
  type: "slide",
  durationFrames: 16,
  direction: "up",
  easing: "outCubic"
});
assert.deepEqual(motionJson.layers[0]?.keyframes, {
  opacity: [
    { frame: 0, value: 0, easing: "outCubic" },
    { frame: 15, value: 1 }
  ]
});
assert.deepEqual(motionJson.layers[1]?.transitionIn, {
  type: "blurDissolve",
  durationFrames: 10,
  amount: 18,
  easing: "outCubic"
});
assert.deepEqual(motionJson.layers[2]?.keyframes, {
  opacity: [{ frame: 0, value: 1 }]
});
assert.deepEqual(motionJson.layers[3]?.textMotion, {
  type: "typeOn",
  split: "char",
  durationFrames: 18,
  easing: "linear",
  staggerFrames: 1,
  preserveLayout: true
});
assert.deepEqual(motionJson.layers[4]?.textMotion, {
  type: "cascade",
  split: "word",
  durationFrames: 12,
  easing: "outCubic",
  staggerFrames: 2,
  preserveLayout: true,
  direction: "up"
});
assert.deepEqual(motionJson.layers[5]?.textMotion, {
  type: "scramble",
  split: "char",
  durationFrames: 10,
  easing: "outCubic",
  staggerFrames: 1,
  seed: 42,
  preserveLayout: true
});
assert.deepEqual(motionJson.layers[6]?.textMotion, {
  type: "highlightSweep",
  split: "word",
  durationFrames: 16,
  easing: "outCubic",
  staggerFrames: 0,
  preserveLayout: true,
  color: "#facc15"
});
assert.deepEqual(motionJson.layers[7]?.textMotion, {
  type: "trackingIn",
  split: "char",
  durationFrames: 14,
  easing: "outCubic",
  staggerFrames: 1,
  origin: "center",
  preserveLayout: true,
  amount: 10
});

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

assert.deepEqual(cinematic.zoomPush({ durationFrames: 12, direction: "right" }), {
  transitionIn: { type: "zoom", durationFrames: 12, amount: 0.18, easing: "outCubic" },
  transitionOut: { type: "push", durationFrames: 12, direction: "right", easing: "inCubic" }
});

const sceneA = text("scene-a", { text: "A", startFrame: 0, durationFrames: 60 });
const sceneB = text("scene-b", { text: "B", startFrame: 48, durationFrames: 42 });
const transitionSeriesComposition = video({
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 90
})
  .add(sceneA, sceneB)
  .tracks(
    track("main", [
      trackClip("a", { layerId: sceneA, startFrame: 0, durationFrames: 60 }),
      trackClip("b", {
        layerId: sceneB,
        startFrame: 48,
        durationFrames: 42,
        transitionFromPrevious: transitionSeries.fromPrevious(
          transition.push({ direction: "left", durationFrames: 12, easing: "outCubic" })
        )
      })
    ])
  )
  .exports(exportPreset.reels());
const transitionSeriesJson = transitionSeriesComposition.toJSON();
assert.deepEqual(transitionSeriesComposition.validate(), { ok: true, errors: [] });
assert.deepEqual(transitionSeriesJson.tracks?.[0]?.clips[1]?.transitionFromPrevious, {
  presentation: { type: "push", direction: "left" },
  timing: { type: "tween", durationFrames: 12, easing: "outCubic" }
});

assert.deepEqual(cinematic.whipPan({ direction: "down" }).transitionIn, {
  type: "push",
  durationFrames: 8,
  direction: "down",
  easing: "inOutCubic"
});
assert.deepEqual(cinematic.filmFlash({ color: "#fff7dd" }).transitionIn, {
  type: "colorDissolve",
  durationFrames: 6,
  color: "#fff7dd",
  amount: 1,
  easing: "outQuad"
});
assert.deepEqual(cinematic.dreamyBlur({ durationFrames: 20 }).transitionIn, {
  type: "blurDissolve",
  durationFrames: 20,
  amount: 18,
  easing: "outCubic"
});
assert.deepEqual(cinematic.broadcastDip().transitionIn, {
  type: "dip",
  durationFrames: 10,
  color: "#05070a",
  amount: 1,
  easing: "inOutCubic"
});
assert.deepEqual(cinematic.irisOpen({ shape: "diamond" }).transitionIn, {
  type: "iris",
  durationFrames: 16,
  shape: "diamond",
  easing: "outCubic"
});
assert.deepEqual(cinematic.flipCard({ axis: "x" }).transitionIn, {
  type: "flip",
  durationFrames: 14,
  axis: "x",
  amount: 90,
  easing: "outCubic"
});
assert.deepEqual(cinematic.glitchCut(), {
  transitionIn: {
    type: "skewSlide",
    durationFrames: 8,
    direction: "left",
    intensity: 12,
    easing: "outExpo"
  },
  keyframes: {
    x: [
      { frame: 0, value: -14, timing: { type: "steps", steps: 2, direction: "end" } },
      { frame: 1, value: 0.3, timing: { type: "steps", steps: 2, direction: "end" } },
      { frame: 3, value: 0, easing: "outExpo" }
    ],
    opacity: [
      { frame: 0, value: 0.72, timing: { type: "steps", steps: 2, direction: "end" } },
      { frame: 3, value: 1 }
    ]
  }
});
assert.deepEqual(cinematic.lightLeak({ durationFrames: 4, color: "#ffd8a8", intensity: 0.5 }), {
  transitionIn: {
    type: "colorDissolve",
    durationFrames: 4,
    color: "#ffd8a8",
    amount: 0.5,
    easing: "outQuad"
  },
  keyframes: {
    x: [
      { frame: 0, value: -5, easing: "outQuad" },
      { frame: 3, value: 5 }
    ],
    opacity: [
      { frame: 0, value: 0.82, easing: "outQuad" },
      { frame: 3, value: 1 }
    ]
  }
});
assert.deepEqual(cinematic.kenBurns({ durationFrames: 30, fromScale: 1, toScale: 1.08 }).keyframes, {
  scale: [
    { frame: 0, value: 1, easing: "outCubic" },
    { frame: 30, value: 1.08 }
  ]
});
assert.deepEqual(cinematic.logoSting({ durationFrames: 10 }), {
  transitionIn: { type: "zoom", durationFrames: 6, amount: 0.12, easing: "outBack" },
  transitionOut: { type: "fade", durationFrames: 5, easing: "inCubic" },
  keyframes: {
    scale: [
      { frame: 0, value: 0.92, easing: "outBack" },
      { frame: 4, value: 1.04, easing: "outBack" },
      { frame: 9, value: 1 }
    ],
    rotation: [
      { frame: 0, value: 2, easing: "outCubic" },
      { frame: 9, value: 0 }
    ]
  }
});
assert.deepEqual(cinematic.productReveal({ durationFrames: 10, direction: "down" }), {
  transitionIn: { type: "wipe", durationFrames: 10, direction: "down", easing: "outCubic" },
  keyframes: {
    scale: [
      { frame: 0, value: 0.96, easing: "outCubic" },
      { frame: 9, value: 1.02 }
    ],
    opacity: [
      { frame: 0, value: 0, easing: "outCubic" },
      { frame: 5, value: 1 }
    ]
  }
});
assert.deepEqual(cinematic.socialHook({ durationFrames: 10, direction: "right", color: "#fffbef" }), {
  transitionIn: {
    type: "colorDissolve",
    durationFrames: 5,
    color: "#fffbef",
    amount: 0.7,
    easing: "outQuad"
  },
  transitionOut: { type: "push", durationFrames: 5, direction: "right", easing: "inCubic" },
  keyframes: {
    scale: [
      { frame: 0, value: 1.16, easing: "outCubic" },
      { frame: 3, value: 0.98, easing: "outBack" },
      { frame: 9, value: 1 }
    ]
  }
});
assert.deepEqual(cinematic.titleSequence({ durationFrames: 10, direction: "up", exitDirection: "down" }), {
  transitionIn: { type: "slide", durationFrames: 10, direction: "up", easing: "outCubic" },
  transitionOut: { type: "slide", durationFrames: 6, direction: "down", easing: "inCubic" },
  keyframes: {
    opacity: [
      { frame: 0, value: 0, easing: "outCubic" },
      { frame: 9, value: 1 }
    ]
  }
});
assert.deepEqual(cinematic.endCard({ durationFrames: 10, color: "#101010", direction: "up" }), {
  transitionIn: { type: "dip", durationFrames: 10, color: "#101010", amount: 1, easing: "inOutCubic" },
  transitionOut: { type: "fade", durationFrames: 5, easing: "inCubic" },
  keyframes: {
    scale: [
      { frame: 0, value: 0.98, easing: "outCubic" },
      { frame: 9, value: 1 }
    ],
    y: [
      { frame: 0, value: 10, easing: "outCubic" },
      { frame: 9, value: -10 }
    ]
  }
});

const poster = asset.image("poster", "https://example.com/poster.jpg");
const cinematicComposition = video({
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 90
})
  .assets(poster, socialClip)
  .add(
    image("poster-layer", {
      asset: poster,
      startFrame: 0,
      durationFrames: 90,
      fit: "cover",
      ...cinematic.kenBurns({
        durationFrames: 60,
        fromScale: 1.02,
        toScale: 1.12,
        fromX: -12,
        toX: 12
      }),
      ...cinematic.dreamyBlur({ durationFrames: 12 })
    }),
    videoLayer("subject-clip", {
      asset: socialClip,
      startFrame: 12,
      durationFrames: 60,
      fit: "cover",
      ...cinematic.kenBurns({
        durationFrames: 45,
        subject: {
          fromX: 0.38,
          fromY: 0.45,
          toX: 0.62,
          toY: 0.48,
          source: "manual"
        }
      }),
      ...cinematic.zoomPush({ durationFrames: 10 })
    })
  )
  .exports(exportPreset.reels());

const cinematicJson = cinematicComposition.toJSON();
assert.deepEqual(cinematicComposition.validate(), { ok: true, errors: [] });
assert.equal(cinematicJson.layers[0]?.transitionIn?.type, "blurDissolve");
assert.equal(cinematicJson.layers[0]?.keyframes?.scale?.[1]?.value, 1.12);
assert.equal(cinematicJson.layers[1]?.transitionIn?.type, "zoom");
assert.equal(cinematicJson.layers[1]?.transitionOut?.type, "push");
assert.equal(cinematicJson.layers[1]?.crop?.mode, "subject");

const cinematicPresetComposition = video({
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 120
})
  .assets(poster)
  .add(
    image("logo-sting-layer", {
      asset: poster,
      startFrame: 0,
      durationFrames: 30,
      fit: "contain",
      ...cinematic.logoSting({ durationFrames: 12 })
    }),
    image("product-reveal-layer", {
      asset: poster,
      startFrame: 20,
      durationFrames: 50,
      fit: "contain",
      ...cinematic.productReveal({ direction: "up" })
    }),
    image("social-hook-layer", {
      asset: poster,
      startFrame: 40,
      durationFrames: 30,
      fit: "cover",
      ...cinematic.socialHook({ direction: "left" })
    }),
    text("title-sequence-layer", {
      text: "Title sequence",
      startFrame: 60,
      durationFrames: 40,
      ...cinematic.titleSequence({ durationFrames: 14 })
    }),
    text("end-card-layer", {
      text: "See you there",
      startFrame: 90,
      durationFrames: 30,
      ...cinematic.endCard({ direction: "up" })
    })
  )
  .exports(exportPreset.reels());

assert.deepEqual(cinematicPresetComposition.validate(), { ok: true, errors: [] });

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
