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
