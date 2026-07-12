# @kitsra/kavio-core

## 0.4.1

### Patch Changes

- 8683091: Add portable cover, reveal, diagonal-wipe, and grayscale-dissolve transitions
  with deterministic browser rendering and equivalent FFmpeg-direct mappings.
  Default-count bar wipes can now use FFmpeg-direct, while custom grids retain the
  browser fallback. Composition inspection reports browser and native support for
  each transition window.
- Updated dependencies [8683091]
  - @kitsra/kavio-schema@0.4.1

## 0.4.0

### Patch Changes

- a6b1fa0: Add FFmpeg-direct rendering for full-frame image sequences with linear scale
  push-in motion, layer fades, and transition-track crossfades. The CLI can now
  select the direct render mode for supported slideshow compositions, transition
  series timing defaults are normalized for exact overlap windows, and the bundled
  Kavio AI skill documents the faster transition-track authoring path.
  - @kitsra/kavio-schema@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [d2c8586]
  - @kitsra/kavio-schema@0.3.0

## 0.2.0

### Patch Changes

- @kitsra/kavio-schema@0.2.0

## 0.1.3

### Patch Changes

- @kitsra/kavio-schema@0.1.3

## 0.1.2

### Patch Changes

- bb2410f: Publish package README metadata for npm package pages.
- Updated dependencies [bb2410f]
  - @kitsra/kavio-schema@0.1.2

## 0.1.1

### Patch Changes

- 38e0355: Add package README files so npm package pages include getting-started guidance.
- Updated dependencies [38e0355]
  - @kitsra/kavio-schema@0.1.1

## 0.1.0

### Minor Changes

- a00f0c3: First published release of the Kavio packages: JSON-first programmable video
  engine with schema, timeline core, TypeScript builder, browser preview runtime,
  render pipeline, CLI, and MCP server.

### Patch Changes

- Updated dependencies [a00f0c3]
  - @kitsra/kavio-schema@0.1.0
