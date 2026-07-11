# @kitsra/kavio-mcp

## Unreleased

### Patch Changes

- Report FFmpeg-direct eligibility for linear full-frame image transition tracks
  using fade/crossfade, directional wipe/slide/push, circular iris/expand-mask,
  default clockwise clock-wipe, zoom, blur dissolve, squeeze, letterbox reveal,
  and constrained dip/color/flash handoffs.

## 0.4.0

### Patch Changes

- a6b1fa0: Add FFmpeg-direct rendering for full-frame image sequences with linear scale
  push-in motion, layer fades, and transition-track crossfades. The CLI can now
  select the direct render mode for supported slideshow compositions, transition
  series timing defaults are normalized for exact overlap windows, and the bundled
  Kavio AI skill documents the faster transition-track authoring path.
- Updated dependencies [a6b1fa0]
  - @kitsra/kavio-render@0.4.0
  - @kitsra/kavio-core@0.4.0
  - @kitsra/kavio-builder@0.4.0
  - @kitsra/kavio-schema@0.4.0
  - @kitsra/kavio-render-worker@0.4.0

## 0.3.0

### Patch Changes

- d2c8586: Still-image `png` export format. Export presets accept `format: "png"` with an optional `frame` field selecting the composition frame to capture (default 0, validated against `durationFrames`; codecs are rejected). Rendering captures one browser frame and writes the PNG directly with no FFmpeg step; the stage paints the effective background (preset, then composition), and `background: "transparent"` produces a real alpha channel. Render metadata records null codecs and `not-used` for FFmpeg.
- Updated dependencies [d2c8586]
- Updated dependencies [d2c8586]
- Updated dependencies [d2c8586]
  - @kitsra/kavio-schema@0.3.0
  - @kitsra/kavio-render@0.3.0
  - @kitsra/kavio-render-worker@0.3.0
  - @kitsra/kavio-builder@0.3.0
  - @kitsra/kavio-core@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [9bcc8cb]
- Updated dependencies [9bcc8cb]
- Updated dependencies [9bcc8cb]
  - @kitsra/kavio-render@0.2.0
  - @kitsra/kavio-render-worker@0.2.0
  - @kitsra/kavio-schema@0.2.0
  - @kitsra/kavio-core@0.2.0
  - @kitsra/kavio-builder@0.2.0

## 0.1.3

### Patch Changes

- 6504e96: Ship the portable Kavio AI skill/plugin bundle and add `emit-skill` for installing the shared skill from the package.
  - @kitsra/kavio-schema@0.1.3
  - @kitsra/kavio-core@0.1.3
  - @kitsra/kavio-render-worker@0.1.3
  - @kitsra/kavio-render@0.1.3
  - @kitsra/kavio-builder@0.1.3

## 0.1.2

### Patch Changes

- bb2410f: Publish package README metadata for npm package pages.
- Updated dependencies [bb2410f]
  - @kitsra/kavio-builder@0.1.2
  - @kitsra/kavio-core@0.1.2
  - @kitsra/kavio-render@0.1.2
  - @kitsra/kavio-render-worker@0.1.2
  - @kitsra/kavio-schema@0.1.2

## 0.1.1

### Patch Changes

- 38e0355: Add package README files so npm package pages include getting-started guidance.
- Updated dependencies [38e0355]
  - @kitsra/kavio-builder@0.1.1
  - @kitsra/kavio-core@0.1.1
  - @kitsra/kavio-render@0.1.1
  - @kitsra/kavio-render-worker@0.1.1
  - @kitsra/kavio-schema@0.1.1

## 0.1.0

### Minor Changes

- a00f0c3: First published release of the Kavio packages: JSON-first programmable video
  engine with schema, timeline core, TypeScript builder, browser preview runtime,
  render pipeline, CLI, and MCP server.

### Patch Changes

- Updated dependencies [a00f0c3]
  - @kitsra/kavio-schema@0.1.0
  - @kitsra/kavio-core@0.1.0
  - @kitsra/kavio-render-worker@0.1.0
  - @kitsra/kavio-render@0.1.0
  - @kitsra/kavio-builder@0.1.0
