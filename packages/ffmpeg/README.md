# @kitsra/kavio-ffmpeg

Inspectable FFmpeg planning primitives for Kavio rendering.

## Install

```bash
corepack pnpm add @kitsra/kavio-ffmpeg
```

## What It Does

- Models FFmpeg plan steps.
- Renders FFmpeg argument arrays from plan objects.
- Plans base video input, trim, fit, and sequencing.
- Plans overlay frame-sequence compositing.
- Plans audio mixing, loudness normalization, finite audio loops, and FFmpeg
  sidechain ducking.

This package builds command plans. It does not execute FFmpeg by itself.

## Links

- Repository: https://github.com/kitsra/kavio
- Render pipeline docs: https://github.com/kitsra/kavio/blob/main/docs/render-pipeline.md
- Package overview: https://github.com/kitsra/kavio/blob/main/docs/packages.md
- License: Elastic-2.0
