# Rendering Status

Kavio ships an early end-to-end render path for opaque video exports. The CLI
captures browser-rendered overlay frames with Playwright, composites them with
FFmpeg, writes the output file, and records render metadata.

```bash
node packages/cli/dist/index.js render examples/basic-json/composition.json
```

Supported final formats in the current render pipeline are `mp4`, `webm`, and
`mov`. Schema-valid `gif`, `png-sequence`, and transparent final outputs are
reserved for later render paths and fail with a clear render error today.

## Render Modes

The default render mode is `browser-overlay`: Kavio captures every frame in
Chromium and pipes PNG frames into FFmpeg. Use it for text, masks, transitions,
keyframes, mixed compositing, and anything visually rich.

For simple static slideshows, use the explicit fast path:

```bash
node packages/cli/dist/index.js render composition.json --render-mode ffmpeg-direct
```

`ffmpeg-direct` skips Chromium and browser PNG capture. Today it supports:

- Shape-only compositions using static rectangular shapes with direct hex colors.
- Image-only compositions where every image layer is full-frame, contiguous,
  non-overlapping, and covers the full composition duration.
- Optional image-layer `transitionIn` / `transitionOut` when the transition type
  is `fade`, the timing is linear, and `durationFrames` is present.
- Optional image-layer `keyframes.scale` when it describes a simple linear
  push-in from `1` to a larger value, with later keyframes holding that value.

It intentionally rejects other image keyframes, non-fade transitions, non-linear
timing, masks, opacity changes, mixed image/text/shape layouts, transition
tracks, and other browser-only features. If it rejects a composition, use the
default `browser-overlay` mode.

For zoomed stills, the direct renderer reads the image as a single frame and
lets FFmpeg `zoompan=d=<durationFrames>:fps=<fps>` create the segment. Do not
loop a still input before `zoompan`; that multiplies segment length and can make
the final `-t` truncate the wrong content.

GetPint/Pintwatch comparison, July 2026: production screenshot + FFmpeg render
measured `12.09s real`; Kavio `ffmpeg-direct` with matching CRF 18, 0.18s
fade-in/out, and 1.025 push-in measured `8.96s real` for the same 720-frame
24s reel. Full-video comparison was SSIM `0.995476` and PSNR `40.20 dB`.

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
  including limited linear fade and scale push-in motion.

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
