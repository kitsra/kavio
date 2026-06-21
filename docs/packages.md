# Package API Overview

Kavio is organized as a TypeScript monorepo. Packages are scoped as `@kitsra/kavio-*`
and versioned in lockstep with [Changesets](https://github.com/changesets/changesets).

## Release flow

Releases are driven by Changesets:

1. Contributors add a changeset with `corepack pnpm changeset` describing the
   change and the bump type. CI fails a pull request that touches publishable
   packages without one.
2. On `main`, the **Release** workflow opens (or updates) a "Version Packages"
   PR that applies the pending changesets and bumps every `@kitsra/kavio-*` package.
3. Merging that PR publishes the packages to **npmjs.com** (with npm provenance)
   and creates a GitHub Release.
4. The GitHub Release triggers the **Publish GitHub Packages** workflow, which
   mirrors the same versions to GitHub Packages.

Required repository secrets:

- `NPM_TOKEN` — automation token for the npmjs `@kitsra` scope (used by the
  Release workflow). The `@kitsra` org/scope must exist on npmjs.com.
- GitHub Packages uses the built-in `GITHUB_TOKEN` (no extra secret needed).

## npmjs.com (public)

Once published, install directly from the default registry:

```bash
corepack pnpm add @kitsra/kavio-cli
corepack pnpm add @kitsra/kavio-mcp
```

### Render binaries for consumers

`@kitsra/kavio-render` declares `ffmpeg-static` and `playwright` as optional
dependencies. Consumers who render to MP4/MOV must provision those binaries
after install:

```bash
# inside your project, after adding @kitsra/kavio-render
corepack pnpm rebuild ffmpeg-static
corepack pnpm exec playwright install chromium
```

Schema validation, inspection, preview wiring, and the builder SDK work without
these binaries.

## GitHub Packages

The repository includes a manual/release workflow for publishing the workspace
packages to GitHub Packages:

- workflow: `Publish GitHub Packages`
- triggers: manual `workflow_dispatch` or a published GitHub Release
- registry: `https://npm.pkg.github.com`
- packages: `packages/*`

Consumers install from GitHub Packages by mapping the `@kitsra` scope:

```ini
@kitsra:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then install normally:

```bash
corepack pnpm add @kitsra/kavio-cli
corepack pnpm add @kitsra/kavio-mcp
```

GitHub Packages requires authentication for package installs unless the package
visibility and access settings allow public anonymous reads. Packages published
from this repository are linked through their `repository` metadata.

Packages use the `@kitsra` scope, which matches the `kitsra` GitHub account that
owns this repository, so GitHub Packages accepts the namespace directly. The
`kavio` brand is preserved in each package name (`@kitsra/kavio-*`). Changing the
scope later is an API change because source imports and inter-package
dependencies also use `@kitsra/kavio-*`.

## @kitsra/kavio-schema

Owns the canonical data contract.

Exports include:

- `schemaVersion`
- Kavio document, layer, asset, audio, export, and error types.
- `validateComposition(input)`
- Migration scaffold for schema `0.1`.

Use this package when you need to validate raw JSON, type an integration, or
generate editor/API repair feedback.

## @kitsra/kavio-core

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

## @kitsra/kavio-builder

Owns TypeScript authoring helpers.

Capabilities include:

- `video(...)` composition builder.
- Asset helpers for video, image, audio, and font assets.
- Layer helpers for video, image, text, shape, and captions.
- `prop(...)` references and metadata.
- `keyframes(...)` and easing helpers.
- Native `transition.*`, `camera.*`, `cinematic.*`, and `textMotion.*`
  authoring helpers.
- Platform-specific social export presets, feed variants, and custom outputs.
- Validation hook for generated documents.

Use this package when JSON should be generated from code.

## @kitsra/kavio-browser-renderer

Owns the browser preview runtime.

Capabilities include:

- `createBrowserRenderer(...)`
- `installBrowserRendererRuntime(...)`
- `createBrowserPreviewController(...)`
- Text, video, image, shape, and caption DOM rendering, including video fit
  metadata and subject-crop preview positioning.
- Font loading and preview controls.

Use this package for local preview and future editor integrations.

## @kitsra/kavio-render-worker

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
that concrete execution layer lives in `@kitsra/kavio-render`.

## @kitsra/kavio-ffmpeg

Owns inspectable FFmpeg planning.

Capabilities include:

- Plan step modeling.
- FFmpeg argument rendering.
- Base video input and fit planning.
- Overlay frame-sequence compositing.
- Audio mix and loudness planning.

This package builds command plans. It does not execute FFmpeg by itself.

## @kitsra/kavio-render

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

## @kitsra/kavio-cli

Owns local command-line workflows.

Implemented commands:

- `validate`
- `inspect`
- `migrate`
- `preview`
- `presets`
- `render`

See [cli.md](cli.md).

## @kitsra/kavio-mcp

Owns agent-facing MCP and provider tool schemas.

Capabilities include:

- Tool catalog for validation, inspection, migration, prop resolution, export
  preset listing, render planning, and rendering.
- Resources for the schema, presets, examples, and enum reference.
- Prompts for authoring, repair, and platform adaptation.
- Anthropic, OpenAI, and Gemini adapter generation from the same catalog.

See [mcp.md](mcp.md) for setup, tool input shapes, render behavior, provider
adapter generation, and troubleshooting.
