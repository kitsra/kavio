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
