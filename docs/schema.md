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
  `track`, `keyframes`, `effects`, `mask`, `transitionIn`, and
  `transitionOut`.

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

Supported easing names include `linear`, quadratic/cubic, circular, exponential,
back/anticipate, elastic, and bounce variants, plus
`cubic-bezier(x1,y1,x2,y2)`.

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

Keyframe segments may also use deterministic timing objects. The timing on a
keyframe controls interpolation from that keyframe to the next keyframe.

```json
{
  "keyframes": {
    "opacity": [
      { "frame": 0, "value": 0, "timing": { "type": "steps", "steps": 4 } },
      { "frame": 15, "value": 1 }
    ]
  }
}
```

## Transitions

`transitionIn` and `transitionOut` use local layer frames and require `type`.
Legacy flat transitions keep using `durationFrames` and optional `easing`.
Transitions may instead provide a `timing` object, whose duration is used when
`durationFrames` is omitted. Native transition types are `fade`, `slide`,
`wipe`, `crossfade`, `zoom`, `push`, `spin`, `rotate`, `flip`, `blurDissolve`,
`colorDissolve`, `dip`, `iris`, `stretch`, `squeeze`, `clockWipe`, `barWipe`,
`gridWipe`, `tileReveal`, `radialBlur`, `zoomBlur`, `bookFlip`,
`pageCurlLite`, `skewSlide`, `expandMask`, `letterboxReveal`, `filmFlash`,
`cameraWhip`, `cover`, `reveal`, `diagonalWipe`, and `grayscaleDissolve`.

Optional tuning fields include `direction`, `axis`, `shape`, `corner`, `color`,
`amount`, `intensity`, `rows`, `columns`, and `easing`; see [Animation](animation.md) for
behavior details.

Deterministic timing object types are:

- `tween`: optional `durationFrames` plus named `easing`.
- `spring`: optional `durationFrames`, `stiffness`, `damping`, `mass`,
  `restSpeed`, and `bounce`.
- `steps`: optional `durationFrames`, required `steps`, and optional
  `direction` of `start` or `end`.
- `sequence`: ordered `segments`, each with `durationFrames`, optional nested
  `timing`, and optional `from` / `to` progress values.
- `stagger`: child offset timing with `childCount`, `eachFrames`, nested
  `timing`, optional `childIndex`, and optional `from`.

```json
{
  "transitionIn": {
    "type": "fade",
    "timing": {
      "type": "sequence",
      "segments": [
        { "durationFrames": 4, "from": 0, "to": -0.1, "timing": { "type": "tween", "easing": "anticipate" } },
        { "durationFrames": 8, "from": -0.1, "to": 1, "timing": { "type": "spring", "stiffness": 120, "damping": 12 } }
      ]
    }
  }
}
```

## Transition Series

`tracks` is an optional composition-level model for clip-to-clip transitions.
Each track contains ordered `clips` that reference existing layer IDs. A clip
can declare `transitionFromPrevious` with split `presentation` and `timing`
objects:

```json
{
  "id": "b",
  "layerId": "scene-b",
  "startFrame": 48,
  "durationFrames": 42,
  "transitionFromPrevious": {
    "presentation": { "type": "push", "direction": "left" },
    "timing": { "type": "tween", "durationFrames": 12, "easing": "outCubic" }
  }
}
```

The core evaluator compiles each `transitionFromPrevious` into an explicit
overlap window that starts at the incoming clip's `startFrame`. Browser preview
and browser-backed render paths consume those overlap windows so outgoing and
incoming clips are evaluated together on the same frame. The timing duration
must fit inside both the previous clip and the incoming clip, and transition
windows on the same track may not overlap. If `timing.easing` is omitted, the
series uses tween timing's linear default.

Per-layer `transitionIn` and `transitionOut` remain valid for entrances, exits,
overlays, and existing compositions.

## Masks

Layer `mask` is the Phase 8 source model for deterministic matte data. The
stable schema accepts:

- shape masks: `rect`, `circle`, and `diamond`
- image asset masks: `{ "kind": "asset", "asset": "id", "mode": "alpha" }`
- procedural masks: `linearGradient`, `radialGradient`, and `scanlines`

Procedural masks require an integer `seed`. Asset masks must reference an image
asset. Optional `resolution` metadata declares the intended mask sampling size
and is checked against render-planning budgets.

```json
{
  "mask": {
    "source": {
      "kind": "procedural",
      "type": "scanlines",
      "seed": 42,
      "frequency": 10,
      "resolution": { "width": 1080, "height": 1920 }
    }
  }
}
```

Video masks, luma asset masks, noise/dither/threshold fields, light leaks, film
burns, and generated overlays are reserved for later phases and are not valid
stable schema values today.

## Captions

Caption layers can define cues and word timings. The core evaluator resolves the
active cue, line text, active word, and highlight state for any frame.

## Audio

`audio` contains timeline-level audio tracks. Tracks reference audio or video
assets and can define role, start frame, duration, volume, fades, loop behavior,
and ducking behavior. Supported finite loops execute through FFmpeg whole-asset
or trimmed-range repeat paths; ambiguous source ranges remain non-looping with
planner diagnostics. Ducking executes through FFmpeg sidechain compression.

## Exports

`exports` declares target outputs such as reels, square, and landscape variants.
Export presets can override dimensions, FPS, codec settings, background, and
layer layout overrides.

Formats are `mp4`, `webm`, `mov`, `gif`, `png-sequence`, and `png`. The `png`
format renders a single still image: the optional `frame` field selects which
composition frame to capture (default 0, validated against `durationFrames`).
The `png-sequence` format renders every composition frame into a directory as
zero-based, five-digit files (`frame-00000.png`, `frame-00001.png`, ...). For
both PNG formats codecs do not apply, and `background: "transparent"` preserves
the alpha channel.

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
import { validateComposition } from "@kitsra/kavio-schema";

const result = validateComposition(document);
if (!result.ok) {
  console.error(result.errors);
}
```

Validation reports all discovered errors using stable codes, JSON paths, stages,
hints, and retryability flags.
