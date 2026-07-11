# @kitsra/kavio-render

Concrete local render execution for Kavio: browser frame capture plus FFmpeg
encoding.

## Install

```bash
corepack pnpm add @kitsra/kavio-render
```

## Render Binaries

Kavio resolves FFmpeg in this order:

1. The executable file named by `KAVIO_FFMPEG_PATH`.
2. A system `ffmpeg` on `PATH`.
3. The optional `ffmpeg-static` package.

An invalid `KAVIO_FFMPEG_PATH` is reported instead of silently selecting a
different binary. To run with FFmpeg 8, install it on the host or point
`KAVIO_FFMPEG_PATH` at it; `ffmpeg-static` is only a compatibility fallback and
is not represented as FFmpeg 8.

Call `resolveFfmpegDiagnostics()` to confirm the exact path, resolution source,
and version that Kavio will use. This value can also be recorded alongside
render metadata:

```ts
import { resolveFfmpegDiagnostics } from "@kitsra/kavio-render";

console.log(await resolveFfmpegDiagnostics());
// { path: "/opt/homebrew/bin/ffmpeg", source: "system", version: "8.0.1" }
```

`@kitsra/kavio-render` also declares `playwright` as an optional dependency.
Projects using the `ffmpeg-static` fallback or browser rendering should
provision those binaries after install:

```bash
corepack pnpm rebuild ffmpeg-static
corepack pnpm exec playwright install chromium
```

No dependency upgrade is required for FFmpeg 8 support: the FFmpeg runtime is
supplied explicitly by the caller or host, avoiding lockfile churn and avoiding
any false claim that the pinned `ffmpeg-static` package provides FFmpeg 8.

## What It Does

- Provides `PlaywrightDriver` for browser frame capture.
- Supports deterministic custom HTML frame callbacks, used by
  `@kitsra/kavio-react` for opt-in component rendering.
- Encodes opaque graphics-only Kavio stage captures as the primary video stream
  so live browser transitions are not dropped by FFmpeg framesync.
- Resolves FFmpeg binaries.
- Assembles render commands.
- Maps linear full-frame image transition tracks to FFmpeg-direct fade,
  directional wipe/slide/push, circular iris, and clock-wipe filters.
- Renders a single composition/export.
- Streams `png-sequence` captures to deterministic `frame-%05d.png` files in a
  new output directory without invoking FFmpeg.
- Expands and renders batch jobs, retaining worker-local Chromium processes
  across compatible browser-overlay jobs while isolating each job in a fresh
  browser context and harness.

## Links

- Repository: https://github.com/kitsra/kavio
- Rendering docs: https://github.com/kitsra/kavio/blob/main/docs/rendering.md
- Render pipeline docs: https://github.com/kitsra/kavio/blob/main/docs/render-pipeline.md
- License: Elastic-2.0
