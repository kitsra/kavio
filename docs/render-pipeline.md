# Render Pipeline Guide

Kavio now has an end-to-end local render path for opaque video outputs. The
general `kavio render` command delegates to `@kitsra/kavio-render`, which captures
browser-rendered overlay frames with Playwright, composes media with FFmpeg, and
returns structured output and metadata.

## Current Status

Implemented:

- Schema validation.
- Pure timeline evaluation.
- Browser preview rendering.
- Browser-driver contracts.
- Frame capture loop helpers.
- FFmpeg plan builders.
- Playwright-backed frame capture.
- FFmpeg command assembly and execution.
- Batch expansion.
- CLI `render` command.
- MVP demo rendering through the shared render pipeline.

Current limits:

- `png-sequence` exports.
- Performance measurement against PRD throughput targets.

## End-To-End Flow

The render pipeline works like this:

1. Load a Kavio document.
2. Resolve props for one row.
3. Apply one export preset and layer overrides.
4. Validate the expanded document.
5. Assemble the FFmpeg command from an inspectable plan and start FFmpeg.
6. Open the browser renderer at the export dimensions.
7. Capture transparent overlay frames and stream them into FFmpeg stdin as an
   `image2pipe` PNG stream, so capture and encode overlap.
8. Compose base video, overlays, and audio.
9. Write output, per-stage timings, and render metadata.
10. Clean up browser contexts on success or failure.

Captured frames are never written to a temporary directory: a bounded byte
queue between capture and FFmpeg applies backpressure, so a slow encode slows
capture instead of buffering the whole render in memory or on disk. Successful
render results include `timings` (capture, encode, checksum, and total wall
time) for performance measurement.

## Why FFmpeg Planning Is Separate

`@kitsra/kavio-ffmpeg` builds inspectable plans before anything is executed. This makes
rendering safer to test and debug:

- Inputs are explicit.
- Filter chains are visible.
- Map/output steps can be reviewed.
- Future execution can record exact arguments and tool versions.

## MVP Demo Render

The MVP demo uses the shared render pipeline. It prepares deterministic
synthetic assets, reads the MVP batch jobs, captures browser-rendered frames,
and encodes MP4 files with FFmpeg directly from the streamed frames.

Commands:

```bash
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run render
```

Outputs:

- `examples/mvp-demo/renders/mvp-demo`

## Render Metadata

`@kitsra/kavio-render-worker` defines metadata and `@kitsra/kavio-render` records it for
successful outputs:

- output name and path
- dimensions
- duration
- codecs
- checksums
- FFmpeg version
- Chromium revision
- creation time

## Cleanup Rules

Render code should:

- Use a cleanup stack for browser contexts and any temporary files.
- Avoid temporary frame files entirely; frames stream to FFmpeg stdin.
- Keep final outputs and metadata only.
- Preserve enough error detail to debug validation, browser, or FFmpeg failures.

## Render Comparison

For two already-rendered videos, Kavio owns the shared comparison/report helper:

```bash
node scripts/compare-render-videos.mjs production.mp4 kavio.mp4
```

Add `--reference-time <seconds>` and `--candidate-time <seconds>` to include
manual wall-clock render timings. Add `--json <path>` or `--markdown <path>` to
write a reusable report. The helper uses local `ffprobe` metadata plus FFmpeg
SSIM/PSNR filters; production-app render scripts stay in their source repos.

## Remaining MVP Gap

The remaining MVP render work is to use captured timings and comparison reports
to guide hardening.
