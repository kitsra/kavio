# Kavio Documentation

Kavio is a pre-release, JSON-first video engine. The current documentation is
organized around the same path a new user follows: install the repo, validate a
composition, preview it locally, author one with the builder SDK, and understand
which rendering pieces are complete.

## Start Here

- [Getting started](getting-started.md): install, build, validate, inspect, and
  preview the included JSON example.
- [Concepts](concepts.md): composition, frames, props, assets, layers, exports,
  preview, render, and batch jobs.
- [Tutorial: Build your first Kavio video](tutorial-first-video.md): create,
  validate, inspect, and preview a small composition.
- [Examples](examples.md): what each example contains and which command to run.
- [CLI reference](cli.md): command behavior, exit codes, JSON output, presets,
  and render options.

## Authoring

- [Template authoring](template-authoring.md): props, assets, layer naming,
  multi-aspect layout, and validation checklist.
- [Animation](animation.md): keyframes, easing, captions, layout-safe motion, and
  demo motion examples.
- [Kavio JSON schema](schema.md): document shape, layers, props, assets, audio,
  exports, and validation errors.
- [Builder SDK](builder.md): TypeScript helpers for generating canonical Kavio
  JSON.

## Preview And Rendering

- [Browser preview](preview.md): local preview server and browser runtime APIs.
- [Render pipeline](render-pipeline.md): end-to-end render flow, metadata,
  cleanup rules, and current format limits.
- [Rendering status](rendering.md): what is implemented now and what remains
  after initial opaque video export support.
- [MVP demo fixture](demo.md): the multi-row, multi-aspect demo fixture.
- [MCP server and agent tools](mcp.md): MCP setup, tools, resources, prompts,
  provider adapters, and render safety notes.

## Reference

- [Package API overview](packages.md): what each workspace package owns.
- [API reference](api-reference.md): current TypeScript package exports and
  usage notes.
- [Troubleshooting](troubleshooting.md): common validation, preview, render, and
  package-manager issues.

## Project Notes

- [Browser renderer architecture](browser-renderer-architecture.md)
- [CI](ci.md)
- [Contributing docs and examples](contributing-docs.md)
- [Plan archive](plan/README.md)
- [Playwright dependency review](playwright-dependency-review.md)
