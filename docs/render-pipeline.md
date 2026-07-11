# Render Pipeline Guide

Kavio now has an end-to-end local render path for video, still-image, and PNG
sequence outputs. The general `kavio render` command delegates to
`@kitsra/kavio-render`, which selects FFmpeg-direct for eligible image sequences
or captures browser-rendered frames with Playwright for full-fidelity output,
then returns structured output and metadata.

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
- Deterministic `png-sequence` export directories.
- FFmpeg-direct eligibility discovery and `auto` render mode.
- Whole-asset and trimmed-range audio loop execution.
- FFmpeg sidechain ducking.
- SSIM/PSNR full-video and selected-frame comparison gates.
- Primary-stream encoding for opaque graphics-only Kavio captures so live PNG
  production cannot starve FFmpeg framesync and drop transition frames.
- CLI `render` command.
- MVP demo rendering through the shared render pipeline.

Current limits:

- Performance measurement against PRD throughput targets and GetPint quality
  baselines.
- Quality comparison and careful expansion beyond the direct renderer's linear
  fade, directional wipe/slide/push, circular iris, clock wipe, zoom, blur,
  squeeze, letterbox, and constrained color-transition variants.

## End-To-End Flow

The render pipeline works like this:

1. Load a Kavio document.
2. Resolve props for one row.
3. Apply one export preset and layer overrides.
4. Validate the expanded document.
5. Assemble the FFmpeg command from an inspectable plan and start FFmpeg.
6. Open the browser renderer at the export dimensions.
7. For browser-overlay video output, capture transparent overlay frames and
   stream them into FFmpeg stdin as an `image2pipe` PNG stream, so capture and
   encode overlap. PNG sequences instead stream ordered frames directly to a
   fresh output directory.
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

### FFmpeg runtime selection and diagnostics

The render runtime resolves FFmpeg in a fixed order: executable
`KAVIO_FFMPEG_PATH`, system `ffmpeg` on `PATH`, then the existing optional
`ffmpeg-static` fallback. An explicitly configured path is validated and a bad
value fails with a correction hint; it never silently changes the requested
runtime.

FFmpeg 8 is supplied by the caller or system. Kavio does not treat the pinned
`ffmpeg-static` fallback as FFmpeg 8, and no package upgrade was made because
runtime selection solves this without dependency or lockfile churn.

Use `resolveFfmpegDiagnostics()` before a render to obtain the exact `path`,
`source`, and parsed `version`. Callers that persist render metadata should pass
that version into their metadata path and may retain the full diagnostics value
in operational logs:

```ts
import { resolveFfmpegDiagnostics } from "@kitsra/kavio-render";

const ffmpeg = await resolveFfmpegDiagnostics();
console.info("Kavio FFmpeg", ffmpeg);
```

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
manual wall-clock render timings. The helper uses local `ffprobe` metadata plus
FFmpeg SSIM/PSNR filters; production-app render scripts stay in their source
repos.

For a CI quality gate, set explicit whole-video thresholds and write compact
JSON to stdout:

```bash
node scripts/compare-render-videos.mjs baseline.mp4 candidate.mp4 \
  --min-ssim 0.98 --min-psnr 35 --json -
```

Use repeatable `--frame <seconds>` flags with `--min-frame-ssim` and
`--min-frame-psnr` to protect important moments independently of aggregate
video quality:

```bash
node scripts/compare-render-videos.mjs baseline.mp4 candidate.mp4 \
  --frame 0.5 --frame 4.25 \
  --min-ssim 0.98 --min-psnr 35 \
  --min-frame-ssim 0.99 --min-frame-psnr 38 --json comparison.json
```

Exit code `0` means all configured thresholds passed, `2` means a quality
threshold regressed, and `1` means the command or FFmpeg execution failed. JSON
contains `passed`, a structured `failures` array, thresholds, probes, aggregate
metrics, and selected-frame metrics. Keep baselines deterministic and choose
timestamps away from scene cuts; SSIM and PSNR detect pixel differences, not
whether a visual change was intentional.

## Remaining MVP Gap

The remaining MVP render work is to use captured timings and comparison reports
to guide hardening.
