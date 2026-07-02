# @kitsra/kavio-render

## 0.2.0

### Minor Changes

- 9bcc8cb: Experimental `renderMode: "ffmpeg-direct"` for `renderComposition`: compositions whose layers can be compiled directly into FFmpeg filters (see `getDirectRenderSupport`) render without launching a browser at all. `assembleDirectRenderCommand` builds the command; shape layers compile to `drawbox` filters. Text and asset layers are not yet eligible.
- 9bcc8cb: Parallel frame capture. `BrowserDriver` gains an optional `fork()` capability, `captureFrames` a `parallelism` option that shards frames across forked drivers while emitting results in strict frame order, and `renderComposition` a `captureParallelism` option defaulting to `min(4, cores - 1)`. `PlaywrightDriver.fork()` launches sibling Chromium processes against the shared harness server, since Chromium serializes screenshot capture within one browser process. Screenshots are taken through a raw CDP session with `optimizeForSpeed` and a one-time transparent-background override, cutting per-frame capture cost by ~40%. Deterministic: output bytes match serial capture. Combined with frame streaming, the 30s demo reel renders ~6x faster (99s to 15.6s on a 10-core machine).
- 9bcc8cb: Stream captured overlay frames straight into FFmpeg stdin (`image2pipe`) so capture and encode overlap, removing the temporary PNG directory round-trip. `FfmpegRunner.run` accepts an async-iterable `stdin` source with backpressure and a bounded number of stream listeners, and `assembleRenderCommand` reads overlay frames from stdin when `framePattern` is omitted. `renderComposition` results now include per-stage `timings` (browser open, capture with evaluate/screenshot split, encode, checksum, total), with per-frame timing available on `BrowserFrameCapture.timing` and aggregates on the `captureFrames` result. `captureFrames` no longer retains streamed frame bytes in memory unless `retainCaptures` is set.

### Patch Changes

- Updated dependencies [9bcc8cb]
- Updated dependencies [9bcc8cb]
  - @kitsra/kavio-render-worker@0.2.0
  - @kitsra/kavio-schema@0.2.0
  - @kitsra/kavio-core@0.2.0
  - @kitsra/kavio-browser-renderer@0.2.0
  - @kitsra/kavio-ffmpeg@0.2.0

## 0.1.3

### Patch Changes

- @kitsra/kavio-schema@0.1.3
- @kitsra/kavio-core@0.1.3
- @kitsra/kavio-browser-renderer@0.1.3
- @kitsra/kavio-render-worker@0.1.3
- @kitsra/kavio-ffmpeg@0.1.3

## 0.1.2

### Patch Changes

- bb2410f: Publish package README metadata for npm package pages.
- Updated dependencies [bb2410f]
  - @kitsra/kavio-browser-renderer@0.1.2
  - @kitsra/kavio-core@0.1.2
  - @kitsra/kavio-ffmpeg@0.1.2
  - @kitsra/kavio-render-worker@0.1.2
  - @kitsra/kavio-schema@0.1.2

## 0.1.1

### Patch Changes

- 38e0355: Add package README files so npm package pages include getting-started guidance.
- Updated dependencies [38e0355]
  - @kitsra/kavio-browser-renderer@0.1.1
  - @kitsra/kavio-core@0.1.1
  - @kitsra/kavio-ffmpeg@0.1.1
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
  - @kitsra/kavio-browser-renderer@0.1.0
  - @kitsra/kavio-render-worker@0.1.0
  - @kitsra/kavio-ffmpeg@0.1.0
