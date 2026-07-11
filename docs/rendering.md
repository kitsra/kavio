# Rendering Status

Kavio ships an early end-to-end render path for browser-backed exports. The CLI
captures browser-rendered overlay frames with Playwright, composites them with
FFmpeg, writes the output file, and records render metadata.

```bash
node packages/cli/dist/index.js render examples/basic-json/composition.json
```

Supported final formats in the current render pipeline are opaque `mp4`,
`webm`, `mov`, `gif`, transparent `webm`/`mov`, still-image `png`, and
`png-sequence` (both opaque or transparent). Still images capture one browser
frame (the preset's `frame`, default 0) and write the PNG directly with no
FFmpeg step. PNG sequences capture every composition frame through the same
browser path and write each frame directly, without FFmpeg or a full-sequence
memory buffer.

## PNG Sequences

A `png-sequence` export writes a new directory containing zero-based,
five-digit files named `frame-00000.png`, `frame-00001.png`, and so on. The API
result uses `outputPath` for the directory and `outputPattern` for the exact
`frame-%05d.png` path pattern. Render metadata also points to the directory;
its SHA-256 checksum covers the ordered concatenation of all captured frame
bytes, and its byte count is the sequence total. Codecs are `null`, FFmpeg is
recorded as `not-used`, and `encodeMs` is zero.

The default directory is the preset name under `outDir`. Existing stable batch
names end in `.zip`; render strips that suffix because the output is a directory,
not an archive. For example, a batch `outputName` of `001-frames.zip` produces
`<outDir>/001-frames/`. A custom `outputName` must be one directory name with no
path separators; use `outDir` for its parent. The destination must not already
exist, which prevents stale frames and accidental deletion. Failed captures
remove the incomplete directory, and `continueOnFrameError` is rejected because
a successful sequence must contain every frame.

CLI text prints `Rendered <outputPath> (browser-overlay)`. CLI JSON returns that
directory in `outputs[].outputPath`; its `outputs[].outputName` remains the
stable logical batch name and may retain `.zip` for compatibility. The
`renderComposition` API additionally returns `outputPattern`.

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
- Transition-track image handoffs when the overlap exactly matches a linear
  `transitionFromPrevious`. FFmpeg `xfade` supports `fade`, `crossfade`,
  directional `wipe`, `slide`, and `push`, circular `iris` / `expandMask`, and
  the default clockwise `clockWipe`.
- Optional image-layer `transitionIn` / `transitionOut` when the transition type
  is `fade`, the timing is linear, and `durationFrames` is present.
- Optional image-layer `keyframes.scale` when it describes a simple linear
  push-in from `1` to a larger value, with later keyframes holding that value.

For reel-style slide handoffs, prefer a top-level transition track with
overlapped `transitionFromPrevious` clips. Adjacent layer `transitionOut` /
`transitionIn` fade pairs fade through the background and are useful for
entrances or exits, but they do not create the smoother FFmpeg `xfade` blend and
can be slower for long still-image reels.

Opaque graphics-only browser renders paint the effective background into the
captured Kavio stage and encode that PNG stream as the primary video. This keeps
FFmpeg from advancing a synthetic background ahead of a slower secondary
overlay stream, which previously could collapse intermediate transition frames
into a hard cut. Hybrid renders with source video and custom HTML/React drivers
retain explicit overlay compositing.

It intentionally rejects other image keyframes, unlisted transitions,
non-linear timing, diamond iris masks, non-default clock-wipe directions,
ambiguous overlaps, masks, opacity changes, mixed image/text/shape layouts,
`fit: "none"`, and other browser-only features. If it rejects a composition,
use the default `browser-overlay` mode.

The render API records both `requestedRenderMode` and the resolved `renderMode`
in stage timings. CLI JSON and text output report the resolved mode.

Browser-overlay video and PNG-sequence renders capture multiple frames concurrently by default
using `min(4, cores - 1)` pages. Set `captureParallelism` in
`renderComposition` or `renderBatch`, or pass `--capture-parallelism <n>` to the
CLI. Values must be positive integers. Batch `concurrency` controls jobs while
capture parallelism controls browser pages within each job, so their resource
costs multiply.

Within each batch worker, compatible browser-overlay jobs retain the Chromium
processes assigned to their capture workers. Every job still receives a fresh
browser context, page, and render harness, and all retained processes close when
the batch worker finishes or fails. This avoids paying Chromium startup once per
row or export without sharing page state between jobs. `timings.browserLaunches`
reports how many Chromium processes a render launched; a value of `0` on later
browser-overlay jobs confirms reuse without relying on wall-clock comparisons.

For zoomed stills, the direct renderer reads the image as a single frame and
lets FFmpeg `zoompan=d=<durationFrames>:fps=<fps>` create the segment. Do not
loop a still input before `zoompan`; that multiplies segment length and can make
the final `-t` truncate the wrong content.

To produce a visual comparison report for two existing videos, use the
repo-local FFmpeg helper:

```bash
node scripts/compare-render-videos.mjs production.mp4 kavio.mp4 \
  --min-ssim 0.99 \
  --min-psnr 38 \
  --frame 6 --frame 12 \
  --min-frame-ssim 0.99 \
  --min-frame-psnr 38 \
  --reference-time <seconds> \
  --candidate-time <seconds> \
  --json render-comparison.json \
  --markdown render-comparison.md
```

The helper shells out to `ffprobe` for stream metadata and `ffmpeg` for SSIM and
PSNR. Supplying thresholds makes it a CI gate: regressions exit with code `2`,
while `--json -` writes compact machine-readable output. Set `FFMPEG` or
`FFPROBE` when those binaries are not on `PATH`. Keep the source app's
production render script in Pintwatch; Kavio owns the cross-video
comparison/report.

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

## React Frames

`@kitsra/kavio-react` renders a React component to deterministic static markup
for every frame, then passes those frames through the same Playwright and
FFmpeg execution path. This is an opt-in API path, not a new timeline model or
CLI render mode. Select `browser-overlay` explicitly when passing its driver.
See [React rendering](react.md) for hooks, limitations, performance, and agent
guidance.

`@kitsra/kavio-ffmpeg` includes:

- Inspectable FFmpeg plan objects.
- Argument rendering from plan steps.
- Base video trim, scale, crop, contain, cover, and concat planning.
- Overlay frame-sequence planning.
- Audio mix planning and execution for music, source audio, voiceover, fades,
  loudness, finite whole-asset or trimmed-range loops, and FFmpeg sidechain
  ducking. Ambiguous loop boundaries remain non-looping and are reported in
  planner diagnostics rather than guessed.
- FFmpeg-direct planning for static shape layers and full-frame image sequences,
  including limited linear fade, scale push-in, and exact `xfade` overlap
  motion.

## What Remains For MVP Rendering

The remaining render work is hardening and coverage: measure render throughput
and total render time against PRD targets, tune direct-render transition quality
against the browser path, broaden format support, and add alpha-capable outputs.

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
