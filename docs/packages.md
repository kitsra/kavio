# Package API Overview

Kavio is organized as a TypeScript monorepo. Packages are scoped as `@kavio/*`.
No packages have been published yet.

## @kavio/schema

Owns the canonical data contract.

Exports include:

- `schemaVersion`
- Kavio document, layer, asset, audio, export, and error types.
- `validateComposition(input)`
- Migration scaffold for schema `0.1`.

Use this package when you need to validate raw JSON, type an integration, or
generate editor/API repair feedback.

## @kavio/core

Owns pure timeline evaluation.

Capabilities include:

- Prop resolution for `{{name}}` placeholders.
- Layer visibility and local-frame evaluation.
- Easing and numeric keyframe interpolation.
- Position, anchor, size, and percentage resolution.
- Caption cue and word-highlight evaluation.
- Export layer override application.
- Resource limit constants and violations.

This package has no browser, FFmpeg, network, or filesystem dependency.

## @kavio/builder

Owns TypeScript authoring helpers.

Capabilities include:

- `video(...)` composition builder.
- Asset helpers for video, image, audio, and font assets.
- Layer helpers for video, image, text, shape, and captions.
- `prop(...)` references and metadata.
- `keyframes(...)` and easing helpers.
- Platform-specific social export presets, feed variants, and custom outputs.
- Validation hook for generated documents.

Use this package when JSON should be generated from code.

## @kavio/browser-renderer

Owns the browser preview runtime.

Capabilities include:

- `createBrowserRenderer(...)`
- `installBrowserRendererRuntime(...)`
- `createBrowserPreviewController(...)`
- Text, video, image, shape, and caption DOM rendering, including video fit
  metadata and subject-crop preview positioning.
- Font loading and preview controls.

Use this package for local preview and future editor integrations.

## @kavio/render-worker

Owns render orchestration contracts and helpers.

Capabilities include:

- Browser-driver interfaces.
- Deterministic browser metadata.
- Frame capture result modeling.
- Capture-loop helpers.
- Batch expansion and output naming.
- Render output metadata.
- Cleanup stack utilities.

This package does not provide a complete Playwright-to-FFmpeg render command;
that concrete execution layer lives in `@kavio/render`.

## @kavio/ffmpeg

Owns inspectable FFmpeg planning.

Capabilities include:

- Plan step modeling.
- FFmpeg argument rendering.
- Base video input and fit planning.
- Overlay frame-sequence compositing.
- Audio mix and loudness planning.

This package builds command plans. It does not execute FFmpeg by itself.

## @kavio/render

Owns concrete local render execution.

Capabilities include:

- `PlaywrightDriver` for browser frame capture.
- `FfmpegRunner` and binary resolution helpers.
- Pure `assembleRenderCommand(...)`.
- `renderComposition(...)` for one composition/export.
- `renderBatch(...)` for prop rows times export presets.
- Test fakes for binary-free orchestration coverage.

This package is the only workspace package that should launch Chromium or spawn
FFmpeg.

## @kavio/cli

Owns local command-line workflows.

Implemented commands:

- `validate`
- `inspect`
- `migrate`
- `preview`
- `presets`
- `render`

See [cli.md](cli.md).

## @kavio/mcp

Owns agent-facing MCP and provider tool schemas.

Capabilities include:

- Tool catalog for validation, inspection, migration, prop resolution, export
  preset listing, render planning, and rendering.
- Resources for the schema, presets, examples, and enum reference.
- Prompts for authoring, repair, and platform adaptation.
- Anthropic, OpenAI, and Gemini adapter generation from the same catalog.

See [mcp.md](mcp.md) for setup, tool input shapes, render behavior, provider
adapter generation, and troubleshooting.
