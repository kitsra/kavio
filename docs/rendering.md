# Rendering Status

Kavio ships an early end-to-end render path for browser-backed exports. The CLI
captures browser-rendered overlay frames with Playwright, composites them with
FFmpeg, writes the output file, and records render metadata.

```bash
node packages/cli/dist/index.js render examples/basic-json/composition.json
```

Supported final formats in the current render pipeline are opaque `mp4`,
`webm`, `mov`, `gif`, transparent `webm`/`mov`, and still-image `png` (opaque
or transparent). Still images capture one browser frame (the preset's `frame`,
default 0) and write the PNG directly with no FFmpeg step, so alpha output
works out of the box. Schema-valid `png-sequence` outputs are reserved for a
later archive render path and fail with a clear render error today.

Video layers compose in two ways: layers that do not overlap in time
concatenate into the sequential base timeline, and layers overlapping the base
become picture-in-picture planes — scaled to the layer `size`, positioned at
its resolved top-left, visible only within their frame window, stacked in
document order under the browser graphics overlay. Pip position is static per
layer today.

## Render Modes

The default render mode is `browser-overlay`: Kavio captures every frame in
Chromium and pipes PNG frames into FFmpeg. Use it for text, masks, transitions,
keyframes, mixed compositing, and anything visually rich.

Use `auto` to select FFmpeg-direct when `getDirectRenderSupport` reports the
resolved composition is eligible and otherwise fall back to browser-overlay:

```bash
node packages/cli/dist/index.js render composition.json --render-mode auto
```

For simple static slideshows, use the explicit fast path:

```bash
node packages/cli/dist/index.js render composition.json --render-mode ffmpeg-direct
```

`ffmpeg-direct` skips Chromium and browser PNG capture. Today it supports:

- Shape-only compositions using static rectangular shapes with direct hex colors.
- Image-only compositions where every image layer is full-frame, does not use
  `fit: "none"`, and either is contiguous or is represented by one transition
  track covering the full duration.
- Transition-track image handoffs only when the overlap exactly matches a
  linear `fade` / `crossfade` `transitionFromPrevious`; FFmpeg `xfade` performs
  the blend.
- Optional image-layer `transitionIn` / `transitionOut` when the transition type
  is `fade`, the timing is linear, and `durationFrames` is present.
- Optional image-layer `keyframes.scale` when it describes a simple linear
  push-in from `1` to a larger value, with later keyframes holding that value.

For reel-style slide handoffs, prefer a top-level transition track with
overlapped `transitionFromPrevious` clips. Adjacent layer `transitionOut` /
`transitionIn` fade pairs fade through the background and are useful for
entrances or exits, but they do not create the smoother FFmpeg `xfade` blend and
can be slower for long still-image reels.

It intentionally rejects other image keyframes, non-fade transitions, non-linear
timing, ambiguous overlaps, masks, opacity changes, mixed image/text/shape
layouts, `fit: "none"`, and other browser-only features. If it rejects a
composition, use the default `browser-overlay` mode.

The render API records both `requestedRenderMode` and the resolved `renderMode`
in stage timings. CLI JSON and text output report the resolved mode.

Browser-overlay video renders capture multiple frames concurrently by default
using `min(4, cores - 1)` pages. Set `captureParallelism` in
`renderComposition` or `renderBatch`, or pass `--capture-parallelism <n>` to the
CLI. Values must be positive integers. Batch `concurrency` controls jobs while
capture parallelism controls browser pages within each job, so their resource
costs multiply.

For zoomed stills, the direct renderer reads the image as a single frame and
lets FFmpeg `zoompan=d=<durationFrames>:fps=<fps>` create the segment. Do not
loop a still input before `zoompan`; that multiplies segment length and can make
the final `-t` truncate the wrong content.

To produce a visual comparison report for two existing videos, use the
repo-local FFmpeg helper:

```bash
node scripts/compare-render-videos.mjs production.mp4 kavio.mp4 \
  --reference-time <seconds> \
  --candidate-time <seconds> \
  --json render-comparison.json \
  --markdown render-comparison.md
```

The helper shells out to `ffprobe` for stream metadata and `ffmpeg` for SSIM and
PSNR. Set `FFMPEG` or `FFPROBE` when those binaries are not on `PATH`. Keep the
source app's production render script in Pintwatch; Kavio only owns the
cross-video comparison/report.

## What Exists Now

`@kitsra/kavio-render-worker` includes:

- Browser-driver contracts.
- Deterministic Chromium launch metadata and flags.
- Viewport creation from composition dimensions.
- PNG frame-capture result modeling.
- Frame capture loop helpers.
- Batch input expansion from one template plus prop rows and export presets.
- Stable output naming helpers.
- Render metadata shape with dimensions, duration, codecs, checksums, FFmpeg
  version, and Chromium revision.
- Cleanup primitives for browser contexts, temporary frames, temporary files,
  and custom cleanup hooks.

`@kitsra/kavio-ffmpeg` includes:

- Inspectable FFmpeg plan objects.
- Argument rendering from plan steps.
- Base video trim, scale, crop, contain, cover, and concat planning.
- Overlay frame-sequence planning.
- Audio mix planning for music, source audio, voiceover, fades, loudness, and
  basic ducking metadata.
- FFmpeg-direct planning for static shape layers and full-frame image sequences,
  including limited linear fade, scale push-in, and exact `xfade` overlap
  motion.

## What Remains For MVP Rendering

The remaining render work is hardening and coverage: measure render throughput
and total render time against PRD targets, add golden-frame comparison, broaden
format support, and add alpha-capable outputs.

## Current Demo Capability

The MVP demo can generate and validate 15 expanded render jobs:

- Five prop rows.
- Three export presets.
- Stable output names.
- Export-specific layer overrides.

Run:

```bash
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run build
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run validate
```

It can also create local demo MP4s through the shared render pipeline:

```bash
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run render
```

This command prepares deterministic synthetic video/audio assets, reuses the
Kavio brand logo, expands five rows across three export presets, and renders all
15 MP4 outputs with `@kitsra/kavio-render`.
Local rendering requires the optional Playwright Chromium browser and FFmpeg
binary to be available.

## Implementation Policy

Rendering should stay inspectable:

- Build a plan before running external tools.
- Keep FFmpeg arguments visible and testable.
- Record tool versions and output metadata.
- Clean up temporary files on success and failure.
- Do not hide schema, asset, or FFmpeg failures behind generic render errors.
