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

- `gif` exports.
- `png-sequence` exports.
- Transparent final outputs.
- Performance measurement against PRD throughput targets.

## End-To-End Flow

The render pipeline works like this:

1. Load a Kavio document.
2. Resolve props for one row.
3. Apply one export preset and layer overrides.
4. Validate the expanded document.
5. Open the browser renderer at the export dimensions.
6. Capture transparent overlay frames.
7. Build an inspectable FFmpeg plan.
8. Compose base video, overlays, and audio.
9. Write output and render metadata.
10. Clean up temporary files on success or failure.

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
encodes MP4 files with FFmpeg, and removes temporary frame files after each
render.

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

- Use a cleanup stack for browser contexts and temporary files.
- Remove temporary frames and layer files after success.
- Remove temporary files after failures where possible.
- Keep final outputs and metadata only.
- Preserve enough error detail to debug validation, browser, or FFmpeg failures.

## Remaining MVP Gap

The remaining MVP render work is to measure capture throughput and total render
time, then use those measurements to guide hardening.
