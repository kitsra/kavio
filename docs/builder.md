# Builder SDK

`@kitsra/kavio-builder` is the TypeScript authoring layer for generating canonical
Kavio JSON. It is useful when templates are easier to compose with variables,
helpers, shared functions, or generated variants.

## Basic Example

```ts
import {
  asset,
  crop,
  exportPreset,
  clip,
  image,
  keyframes,
  prop,
  text,
  transition,
  video
} from "@kitsra/kavio-builder";

const headline = prop("headline", {
  type: "string",
  required: true,
  maxLength: 120
});

const logo = asset.image("logo", "{{logoUrl}}");
const mainClip = asset.video("mainClip", "{{clipUrl}}");

const composition = video({
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 150,
  background: "#111111"
})
  .props(headline)
  .assets(logo, mainClip)
  .add(
    clip("background-video", {
      asset: mainClip,
      startFrame: 0,
      durationFrames: 150,
      fit: "cover",
      crop: crop.subject({
        keyframes: [
          { frame: 0, x: 0.42, y: 0.44 },
          { frame: 90, x: 0.58, y: 0.46 }
        ]
      })
    }),
    image("logo", {
      asset: logo,
      startFrame: 0,
      durationFrames: 150,
      position: { x: "50%", y: 180 },
      anchor: "center",
      size: { width: 240, height: 120 },
      fit: "contain"
    }),
    text("headline", {
      text: headline,
      startFrame: 10,
      durationFrames: 120,
      position: { x: "50%", y: "50%" },
      anchor: "center",
      size: { width: "82%w" },
      style: {
        fontSize: 76,
        fontWeight: 800,
        color: "#ffffff",
        align: "center",
        wrap: true
      },
      transitionIn: transition.slide({
        direction: "up",
        durationFrames: 14,
        easing: "outCubic"
      })
    }).animate(
      "opacity",
      keyframes([
        [0, 0, "outQuad"],
        [15, 1]
      ])
    ).exit(transition.fade({ durationFrames: 10, easing: "inCubic" }))
  )
  .exports(...exportPreset.social());

const json = composition.toJSON();
const validation = composition.validate();
```

## Helpers

Top-level helpers:

- `video(composition, options?)`: creates a `VideoBuilder`.
- `prop(name, metadata?)`: creates a safe prop reference and optional prop
  definition.
- `validate(input)`: validates a `VideoBuilder`, Kavio document, or unknown
  input.
- `keyframes(frames)`: normalizes tuple or object keyframe input.
- `transition.fade(...)`, `transition.slide(...)`, `transition.wipe(...)`,
  `transition.crossfade(...)`, `transition.zoom(...)`, `transition.push(...)`,
  `transition.spin(...)`, `transition.rotate(...)`, `transition.flip(...)`,
  `transition.blurDissolve(...)`, `transition.colorDissolve(...)`,
  `transition.dip(...)`, `transition.iris(...)`, `transition.stretch(...)`,
  `transition.squeeze(...)`, `transition.clockWipe(...)`,
  `transition.barWipe(...)`, `transition.gridWipe(...)`,
  `transition.tileReveal(...)`, `transition.radialBlur(...)`,
  `transition.zoomBlur(...)`, `transition.bookFlip(...)`,
  `transition.pageCurlLite(...)`, `transition.skewSlide(...)`,
  `transition.expandMask(...)`, `transition.letterboxReveal(...)`,
  `transition.filmFlash(...)`, `transition.cameraWhip(...)`,
  `transition.cover(...)`, `transition.reveal(...)`,
  `transition.diagonalWipe(...)`, and `transition.grayscaleDissolve(...)`: create native
  transition definitions.
- `track(id, clips?)`, `trackClip(id, options)`, and
  `transitionSeries.fromPrevious(...)`: create composition-level transition
  series data from ordinary layers and native transition helpers.
- `camera.kenBurns(...)`, `camera.pushIn(...)`, `camera.pullBack(...)`,
  `camera.pan(...)`, `camera.tilt(...)`, `camera.parallax(...)`,
  `camera.orbitLite(...)`, `camera.handheld(...)`, `camera.crashZoom(...)`,
  and `camera.dollyZoomLite(...)`: create deterministic camera keyframes.
- `cinematic.zoomPush(...)`, `cinematic.whipPan(...)`,
  `cinematic.filmFlash(...)`, `cinematic.dreamyBlur(...)`,
  `cinematic.broadcastDip(...)`, `cinematic.irisOpen(...)`,
  `cinematic.flipCard(...)`, `cinematic.glitchCut(...)`,
  `cinematic.lightLeak(...)`, `cinematic.kenBurns(...)`,
  `cinematic.logoSting(...)`, `cinematic.productReveal(...)`,
  `cinematic.socialHook(...)`, `cinematic.titleSequence(...)`, and
  `cinematic.endCard(...)`: create cinematic layer fragments from native
  transitions, timing objects, and keyframes.
- `textMotion.rise(...)` and `textMotion.blurIn(...)`: create whole-text-layer
  motion fragments.
- `textMotion.typeOn(...)`, `textMotion.cascade(...)`,
  `textMotion.scramble(...)`, `textMotion.highlightSweep(...)`, and
  `textMotion.trackingIn(...)`: create first-class `textMotion` fragments for
  text layers.
- `presetNamespaces`: exposes the reserved `transition`, `cinematic`,
  `textMotion`, `camera`, and `effect` namespaces for tools and editors.

Asset helpers:

- `asset.video(id, src, options?)`
- `asset.image(id, src, options?)`
- `asset.audio(id, src, options?)`
- `asset.font(id, src, { family, ...options })`

Layer helpers:

- `clip(id, options)` or `videoLayer(id, options)`
- `pictureInPicture(id, options)` for a responsive, muted video inset with
  corner placement, proportional sizing, and safe stacking defaults.
- `image(id, options)`
- `text(id, options)`
- `shape(id, options)`
- `caption(id, options)`
- `crop.subject(options)` for normalized subject-aware video crop metadata.
- `crop.center()` for explicit centered cover crops.

Layer builders also support `.transitionIn(...)`, `.transitionOut(...)`,
`.enter(...)`, `.exit(...)`, and `.motion(...)` for fluent transition and
keyframe assignment.

### Picture In Picture

Add the full-frame base video before the inset so overlapping video layers are
stacked in document order. The helper defaults to top-right, 32% canvas width,
16:9, a 3% edge inset, `fit: "cover"`, `muted: true`, and `z: 100`.

```ts
import {
  asset,
  exportPreset,
  pictureInPicture,
  video,
  videoLayer
} from "@kitsra/kavio-builder";

const main = asset.video("main", "./main.mp4");
const guest = asset.video("guest", "./guest.mp4");

const composition = video({
  width: 1920,
  height: 1080,
  fps: 30,
  durationFrames: 300
})
  .assets(main, guest)
  .add(
    videoLayer("main", {
      asset: main,
      startFrame: 0,
      durationFrames: 300,
      fit: "cover"
    }),
    pictureInPicture("guest", {
      asset: guest,
      startFrame: 30,
      durationFrames: 240,
      placement: "bottom-right",
      widthPercent: 30,
      insetPercent: 4,
      aspectRatio: 4 / 3
    })
  )
  .exports(exportPreset.landscape());
```

Placements are `top-left`, `top-right`, `bottom-left`, and `bottom-right`.
Override `position`, `anchor`, or `size` for fully custom geometry. PiP source
audio is intentionally not mixed automatically; declare the desired Kavio
audio track explicitly to avoid playing both video sources at once.

Transition series helpers emit top-level `tracks` while preserving ordinary
layers:

```ts
const sceneA = text("scene-a", { text: "A", startFrame: 0, durationFrames: 60 });
const sceneB = text("scene-b", { text: "B", startFrame: 48, durationFrames: 42 });

video({ width: 1080, height: 1920, fps: 30, durationFrames: 90 })
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
  );
```

Camera helpers emit ordinary keyframe maps:

```ts
image("product-photo", {
  asset: product,
  startFrame: 0,
  durationFrames: 90,
  fit: "cover",
  keyframes: camera.kenBurns({
    durationFrames: 90,
    direction: "right",
    safeArea: 0.1,
    easing: "inOutCubic"
  })
}).motion(camera.pushIn({ durationFrames: 90, intensity: 0.04 }));
```

Additional camera helpers are still plain keyframe maps:

```ts
image("detail", {
  asset: product,
  startFrame: 0,
  durationFrames: 72,
  fit: "cover",
  keyframes: camera.orbitLite({
    durationFrames: 72,
    direction: "right",
    restingX: 540,
    restingY: 960,
    easing: "inOutCubic"
  })
});

const handheld = camera.handheld({
  durationFrames: 48,
  seed: 42,
  amount: 6,
  rotationAmount: 0.6
});
```

For example, `camera.crashZoom({ durationFrames: 8, direction: "in" })`
emits scale keyframes like:

```json
{
  "scale": [
    { "frame": 0, "value": 1, "easing": "outCubic" },
    { "frame": 2, "value": 1.336, "easing": "outBack" },
    { "frame": 7, "value": 1.28 }
  ]
}
```

Cinematic helpers emit layer fragments:

```ts
image("hero", {
  asset: hero,
  startFrame: 0,
  durationFrames: 90,
  fit: "cover",
  ...cinematic.kenBurns({ durationFrames: 60, fromScale: 1.02, toScale: 1.12 }),
  ...cinematic.dreamyBlur({ durationFrames: 12 })
});
```

Expanded cinematic presets can be spread onto image, video, text, or shape
layers when their generated transitions and keyframes fit the layer:

```ts
image("product", {
  asset: product,
  startFrame: 0,
  durationFrames: 72,
  fit: "contain",
  ...cinematic.productReveal({ direction: "up", durationFrames: 18 })
});

text("end-card", {
  text: "Available now",
  startFrame: 96,
  durationFrames: 48,
  ...cinematic.endCard({ color: "#05070a", direction: "up" })
});
```

Text-motion helpers support two paths. `rise` and `blurIn` still emit ordinary
`transitionIn` and `keyframes` data for whole-layer entrances. `typeOn`,
`cascade`, `scramble`, `highlightSweep`, and `trackingIn` emit a `textMotion`
object on the text layer.

The browser renderer supports `split: "none"`, `"word"`, `"char"`, and
`"line"`. Word and character splitting preserves spaces as text nodes; line
splitting uses explicit newlines in the text. Fragment spans are drawn inside
the final text box so wrapping is decided from the resting text, not from the
animated state. Use `restingBox: { width, height }` or layer `size` when a
template needs a fixed measured box.

```ts
text("headline", {
  text: "Launch day",
  startFrame: 0,
  durationFrames: 48,
  ...textMotion.cascade({ durationFrames: 12, split: "word", staggerFrames: 2 })
});
```

Export helpers:

- `exportPreset.vertical(options?)`: `1080x1920`
- `exportPreset.reels(options?)`: `1080x1920`
- `exportPreset.instagramReels(options?)`: `1080x1920`
- `exportPreset.tiktok(options?)`: `1080x1920`
- `exportPreset.youtubeShorts(options?)`: `1080x1920`
- `exportPreset.facebookReels(options?)`: `1080x1920`
- `exportPreset.square(options?)`: `1080x1080`
- `exportPreset.portrait(options?)`: `1080x1350`
- `exportPreset.landscape(options?)`: `1920x1080`
- `exportPreset.social(options?)`: returns platform-specific social presets and feed variants.
- `exportPreset.custom(options)`: caller-provided dimensions and name

Subject-aware crops are deterministic render metadata. A detector or editor can
write normalized focus points from `0` to `1`, and the FFmpeg render path keeps
that point framed when a `cover` video layer is cropped:

```ts
clip("background-video", {
  asset: mainClip,
  startFrame: 0,
  durationFrames: 240,
  fit: "cover",
  crop: crop.subject({
    keyframes: [
      { frame: 0, x: 0.42, y: 0.44 },
      { frame: 120, x: 0.58, y: 0.46 }
    ],
    source: "manual"
  })
});
```

## Output

`toJSON()` returns a plain Kavio document. Builder references are normalized:

- Prop references become `{{propName}}` strings.
- Asset references become asset ids.
- Undefined optional fields are omitted.
- Layer and asset definitions are registered as they are used.

## Dogfood Example

The workspace includes a builder example that emits JSON equivalent to the raw
JSON example:

```bash
corepack pnpm --filter @kitsra/kavio-example-basic-builder run build
corepack pnpm --filter @kitsra/kavio-example-basic-builder run emit
```

The root test suite compares this output against
`examples/basic-json/composition.json`.
