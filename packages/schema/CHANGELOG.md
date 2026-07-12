# @kitsra/kavio-schema

## 0.4.1

### Patch Changes

- 8683091: Add portable cover, reveal, diagonal-wipe, and grayscale-dissolve transitions
  with deterministic browser rendering and equivalent FFmpeg-direct mappings.
  Default-count bar wipes can now use FFmpeg-direct, while custom grids retain the
  browser fallback. Composition inspection reports browser and native support for
  each transition window.

## 0.4.0

## 0.3.0

### Minor Changes

- d2c8586: Still-image `png` export format. Export presets accept `format: "png"` with an optional `frame` field selecting the composition frame to capture (default 0, validated against `durationFrames`; codecs are rejected). Rendering captures one browser frame and writes the PNG directly with no FFmpeg step; the stage paints the effective background (preset, then composition), and `background: "transparent"` produces a real alpha channel. Render metadata records null codecs and `not-used` for FFmpeg.

## 0.2.0

## 0.1.3

## 0.1.2

### Patch Changes

- bb2410f: Publish package README metadata for npm package pages.

## 0.1.1

### Patch Changes

- 38e0355: Add package README files so npm package pages include getting-started guidance.

## 0.1.0

### Minor Changes

- a00f0c3: First published release of the Kavio packages: JSON-first programmable video
  engine with schema, timeline core, TypeScript builder, browser preview runtime,
  render pipeline, CLI, and MCP server.
