# API Reference

This is a practical reference for the current TypeScript packages. The API is
pre-release and may change before the first public package publish.

## @kavio/schema

Use this package for the canonical document contract.

Key exports:

- `schemaVersion`
- `validateComposition(input)`
- Kavio document, asset, layer, audio, export, caption, and error types.

Example:

```ts
import { validateComposition, type KavioDocument } from "@kavio/schema";

const document: KavioDocument = loadDocument();
const result = validateComposition(document);

if (!result.ok) {
  for (const error of result.errors) {
    console.error(error.path, error.code, error.message);
  }
}
```

## @kavio/core

Use this package for pure timeline and layout evaluation.

Key capabilities:

- `resolveDocumentProps(...)`
- layer visibility and local-frame evaluation
- easing and keyframe interpolation
- point, size, anchor, and percentage-unit resolution
- caption cue and word-highlight evaluation
- resource limit constants
- export layer override helpers

This package should stay deterministic and independent of browser, filesystem,
network, and FFmpeg behavior.

## @kavio/builder

Use this package to author Kavio JSON with TypeScript helpers.

Top-level exports:

- `video(composition, options?)`
- `prop(name, metadata?)`
- `validate(input)`
- `keyframes(frames)`
- `easing`

Asset helpers:

- `asset.video(id, src, options?)`
- `asset.image(id, src, options?)`
- `asset.audio(id, src, options?)`
- `asset.font(id, src, options)`

Layer helpers:

- `clip(id, options)`
- `videoLayer(id, options)`
- `image(id, options)`
- `text(id, options)`
- `shape(id, options)`
- `caption(id, options)`
- `layers`
- `crop.subject(options)`
- `crop.center()`

Export helpers:

- `exportPreset.vertical(options?)`
- `exportPreset.reels(options?)`
- `exportPreset.instagramReels(options?)`
- `exportPreset.tiktok(options?)`
- `exportPreset.youtubeShorts(options?)`
- `exportPreset.facebookReels(options?)`
- `exportPreset.square(options?)`
- `exportPreset.portrait(options?)`
- `exportPreset.landscape(options?)`
- `exportPreset.social(options?)`
- `exportPreset.custom(options)`
- `socialMediaPresets`

## @kavio/browser-renderer

Use this package for browser preview and future editor integrations.

Key exports:

- `createBrowserRenderer(options?)`
- `installBrowserRendererRuntime(options?)`
- `createBrowserPreviewController(options?)`

Runtime shape:

```ts
const runtime = installBrowserRendererRuntime({ document, root });
await runtime.loadComposition(composition);
await runtime.renderFrame(42);
```

Preview controller methods:

- `loadComposition(composition, options?)`
- `renderFrame(frame?)`
- `setFrame(frame)`
- `step(delta?)`
- `play()`
- `pause()`
- `togglePlayback(force?)`
- `setSafeZonesVisible(visible)`
- `setPreviewExport(selection)`
- `destroy()`

## @kavio/render-worker

Use this package for render orchestration contracts and helpers.

Key exports and concepts:

- `BrowserDriver`
- `createBrowserViewport(composition, deviceScaleFactor?)`
- `createBrowserDriverMetadata(options)`
- `createPngFrameCapture(options)`
- `captureFrames(options)`
- `expandRenderBatch(input)`
- `createStableOutputName(options)`
- `createRenderMetadata(options)`
- `RenderCleanupStack`
- cleanup task helpers

The concrete Playwright driver is exposed by `@kavio/render`.

## @kavio/ffmpeg

Use this package to construct inspectable FFmpeg plans.

Key exports:

- `createEmptyPlan()`
- `appendPlanStep(plan, step)`
- `renderFfmpegArgs(plan)`
- `framesToSeconds(frames, fps)`
- `formatFfmpegTimestamp(seconds)`
- `buildInputTrimArgs(options)`
- `buildFitVideoFilters(options)`
- `planBaseVideo(options)`
- `planBaseVideoSequence(options)`
- `planOverlayCompositing(options)`
- `planAudioMix(options)`
- plan-step builders for inputs, filters, maps, outputs, and arguments

This package builds command plans. It does not execute FFmpeg.

## @kavio/cli

The CLI package exposes the `kavio` binary when published. In the workspace, run:

```bash
node packages/cli/dist/index.js --help
```

Implemented commands:

- `validate`
- `inspect`
- `migrate`
- `preview`
- `render`

See [CLI reference](cli.md).
