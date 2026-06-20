# Kavio JSON Schema

Kavio compositions are versioned JSON documents. The current schema version is
`0.1`.

```json
{
  "version": "0.1",
  "composition": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "durationFrames": 150,
    "background": "#111111",
    "colorSpace": "srgb"
  },
  "props": {},
  "assets": {},
  "layers": [],
  "audio": [],
  "exports": []
}
```

The canonical JSON Schema file is available at
`packages/schema/schema/kavio-0.1.schema.json`.

## Composition

`composition` defines the base timeline:

- `width` and `height`: base canvas dimensions.
- `fps`: timeline frame rate.
- `durationFrames`: total timeline length.
- `background`: optional color or `transparent`.
- `colorSpace`: optional `srgb` or `display-p3`.

## Props

`props` declares placeholders that can be resolved by a batch row, editor, API
call, or builder script.

Supported prop types:

- `string`
- `number`
- `boolean`
- `color`
- `url`
- `enum`
- `asset`

Template values use double braces:

```json
{
  "props": {
    "headline": {
      "type": "string",
      "required": true,
      "maxLength": 120
    }
  },
  "layers": [
    {
      "id": "headline",
      "type": "text",
      "startFrame": 0,
      "durationFrames": 90,
      "text": "{{headline}}"
    }
  ]
}
```

## Assets

`assets` is an object keyed by asset id.

Supported asset types:

- `video`
- `image`
- `audio`
- `font`

Each asset has a `src`. Timed media can include trim and loop options. Font
assets include a `family` name used by text styles.

## Layers

Supported layer types:

- `video`
- `image`
- `text`
- `shape`
- `caption`

All layers share:

- `id`
- `type`
- `startFrame`
- `durationFrames`
- Optional `position`, `anchor`, `size`, `opacity`, `rotation`, `scale`, `z`,
  `track`, `keyframes`, `effects`, `transitionIn`, and `transitionOut`.

Layer timing is inclusive at `startFrame` and exclusive at
`startFrame + durationFrames`.

## Coordinates And Sizes

Numeric values are pixels. Percentage values are resolved against the relevant
canvas dimension:

- `"50%"`: axis-relative percentage.
- `"50%w"`: percentage of canvas width.
- `"50%h"`: percentage of canvas height.

Anchors can be named values such as `center`, `top-left`, and `bottom-right`, or
explicit `{ "x": 0.5, "y": 0.5 }` points.

## Keyframes

The MVP supports numeric keyframes for:

- `opacity`
- `x`
- `y`
- `scale`
- `rotation`

Supported easing names include `linear`, quadratic/cubic in/out variants, back
easing variants, and `cubic-bezier(x1,y1,x2,y2)`.

```json
{
  "keyframes": {
    "opacity": [
      { "frame": 0, "value": 0, "easing": "outQuad" },
      { "frame": 15, "value": 1 }
    ]
  }
}
```

## Captions

Caption layers can define cues and word timings. The core evaluator resolves the
active cue, line text, active word, and highlight state for any frame.

## Audio

`audio` contains timeline-level audio tracks. Tracks reference audio or video
assets and can define role, start frame, duration, volume, fades, loop behavior,
and basic ducking metadata.

## Exports

`exports` declares target outputs such as reels, square, and landscape variants.
Export presets can override dimensions, FPS, codec settings, background, and
layer layout overrides.

The builder SDK provides helpers for common presets:

- `exportPreset.vertical()`
- `exportPreset.reels()`
- `exportPreset.instagramReels()`
- `exportPreset.tiktok()`
- `exportPreset.youtubeShorts()`
- `exportPreset.facebookReels()`
- `exportPreset.square()`
- `exportPreset.portrait()`
- `exportPreset.landscape()`
- `exportPreset.social()`
- `exportPreset.custom(...)`

For raw JSON editing, use the CLI to list supported social media presets or
print one export object that can be pasted into `exports`:

```bash
node packages/cli/dist/index.js presets
node packages/cli/dist/index.js presets instagram-reels
```

Video layers can include `crop` metadata for deterministic subject-aware cover
crops. `crop.mode: "subject"` uses normalized `x` and `y` focus coordinates, or
sorted `keyframes`, to keep the subject framed when the source aspect ratio does
not match the export aspect ratio. This metadata is intended to be authored by a
human, an editor UI, or a future analysis step before render.

## Validation

Use the CLI:

```bash
node packages/cli/dist/index.js validate examples/basic-json/composition.json
```

Or use the package API:

```ts
import { validateComposition } from "@kavio/schema";

const result = validateComposition(document);
if (!result.ok) {
  console.error(result.errors);
}
```

Validation reports all discovered errors using stable codes, JSON paths, stages,
hints, and retryability flags.
