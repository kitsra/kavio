---
"@kitsra/kavio-render": minor
"@kitsra/kavio-render-worker": minor
---

Parallel frame capture. `BrowserDriver` gains an optional `fork()` capability, `captureFrames` a `parallelism` option that shards frames across forked drivers while emitting results in strict frame order, and `renderComposition` a `captureParallelism` option defaulting to `min(4, cores - 1)`. `PlaywrightDriver.fork()` launches sibling Chromium processes against the shared harness server, since Chromium serializes screenshot capture within one browser process. Screenshots are taken through a raw CDP session with `optimizeForSpeed` and a one-time transparent-background override, cutting per-frame capture cost by ~40%. Deterministic: output bytes match serial capture. Combined with frame streaming, the 30s demo reel renders ~6x faster (99s to 15.6s on a 10-core machine).
