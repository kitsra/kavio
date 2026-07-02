---
"@kitsra/kavio-render": minor
"@kitsra/kavio-render-worker": minor
---

Stream captured overlay frames straight into FFmpeg stdin (`image2pipe`) so capture and encode overlap, removing the temporary PNG directory round-trip. `FfmpegRunner.run` accepts an async-iterable `stdin` source with backpressure and a bounded number of stream listeners, and `assembleRenderCommand` reads overlay frames from stdin when `framePattern` is omitted. `renderComposition` results now include per-stage `timings` (browser open, capture with evaluate/screenshot split, encode, checksum, total), with per-frame timing available on `BrowserFrameCapture.timing` and aggregates on the `captureFrames` result. `captureFrames` no longer retains streamed frame bytes in memory unless `retainCaptures` is set.
