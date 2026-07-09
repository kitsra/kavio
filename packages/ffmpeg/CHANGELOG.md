# @kitsra/kavio-ffmpeg

## 0.3.0

### Minor Changes

- d2c8586: Video-in-video compositing. Time-overlapping video layers are no longer concatenated: video layers that don't overlap form the sequential base timeline, and overlapping layers become picture-in-picture planes (new `planVideoPipOverlay`) scaled to the layer's `size`, positioned at its resolved top-left, bounded to its frame window, and stacked in document order under the graphics overlay — so text and graphics composite over any number of simultaneous videos. The render harness now sets `renderVideoLayers: false` (new `BrowserRendererOptions` flag) so video layers are explicitly excluded from browser captures instead of relying on their sources failing to load. Pip position is static (evaluated mid-window); animated video position is not yet supported.

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
