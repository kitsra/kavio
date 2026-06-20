# Builder SDK

`@kavio/builder` is the TypeScript authoring layer for generating canonical
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
  video
} from "@kavio/builder";

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
      }
    }).animate(
      "opacity",
      keyframes([
        [0, 0, "outQuad"],
        [15, 1]
      ])
    )
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

Asset helpers:

- `asset.video(id, src, options?)`
- `asset.image(id, src, options?)`
- `asset.audio(id, src, options?)`
- `asset.font(id, src, { family, ...options })`

Layer helpers:

- `clip(id, options)` or `videoLayer(id, options)`
- `image(id, options)`
- `text(id, options)`
- `shape(id, options)`
- `caption(id, options)`
- `crop.subject(options)` for normalized subject-aware video crop metadata.
- `crop.center()` for explicit centered cover crops.

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
corepack pnpm --filter @kavio/example-basic-builder run build
corepack pnpm --filter @kavio/example-basic-builder run emit
```

The root test suite compares this output against
`examples/basic-json/composition.json`.
