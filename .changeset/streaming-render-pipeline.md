---
"@kitsra/kavio-render": minor
"@kitsra/kavio-render-worker": minor
---

Stream captured overlay frames straight into FFmpeg stdin (`image2pipe`) so capture and encode overlap, removing the temporary PNG directory round-trip. `renderComposition` results now include per-stage `timings` (capture, encode, checksum, total). `captureFrames` no longer retains streamed frame bytes in memory unless `retainCaptures` is set, and `FfmpegRunner.run` accepts an async-iterable `stdin` source. `assembleRenderCommand` reads overlay frames from stdin when `framePattern` is omitted.
