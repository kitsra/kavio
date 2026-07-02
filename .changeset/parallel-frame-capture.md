---
"@kitsra/kavio-render": minor
"@kitsra/kavio-render-worker": minor
---

Parallel frame capture. `BrowserDriver` gains an optional `fork()` capability, `captureFrames` a `parallelism` option that shards frames across forked drivers while emitting results in strict frame order, and `renderComposition` a `captureParallelism` option defaulting to `min(4, cores - 1)`. `PlaywrightDriver.fork()` launches sibling Chromium processes against the shared harness server (Chromium serializes screenshots within one browser process). Deterministic: output bytes match serial capture. Roughly 3x faster browser-overlay renders on multi-core machines.
