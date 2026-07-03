# Kavio

<p>
  <img src="site/assets/brand/kavio-frame-stack-lockup.svg" alt="Kavio" width="360" />
</p>

Kavio is a JSON-first programmable video engine for automation, AI-generated
templates, and future visual editing. It is the video-engine expansion of
Kitsra, but the source and packages use the Kavio name and `@kitsra/kavio-*` package
scope.

The core idea is that video templates should be portable data, not locked to one
UI, cloud API, or authoring runtime. Raw JSON, a TypeScript builder, browser
preview, AI generation, and future editor surfaces should all compile to the
same versioned Kavio composition format.

## Status

Kavio is pre-release. The repository currently includes the schema, validator,
timeline core, TypeScript builder, browser preview runtime, render-worker
contracts, FFmpeg planning helpers, render execution layer, local CLI, MCP
server, provider tool adapters, and MVP demo fixtures.

The general `kavio render` command is implemented for opaque `mp4`, `webm`,
`mov`, `gif`, and transparent `webm`/`mov` outputs through browser frame capture
and FFmpeg. Schema-valid `png-sequence` outputs are reserved for a later archive
render path. The remaining MVP render work is performance measurement and
hardening, not initial command wiring.

## Quick Start

```bash
corepack pnpm install --ignore-scripts
corepack pnpm run build
node bin/kavio.js validate examples/basic-json/composition.json
node bin/kavio.js inspect examples/basic-json/composition.json
node bin/kavio.js preview examples/basic-json/composition.json
```

See [docs/getting-started.md](docs/getting-started.md) for a fuller walkthrough.

For local linked installs, the root package exposes `kavio` and `kavio-mcp`
bin wrappers after the workspace has been installed and built. Installing the
repo directly (`npm i github:kitsra/kavio`) runs the `prepare` build hook, so the
wrappers work without a manual build step. Published npm usage should prefer
`@kitsra/kavio-cli` and `@kitsra/kavio-mcp`.

Releases are managed with [Changesets](https://github.com/changesets/changesets)
and published to both **npmjs.com** (public, via the `Release` workflow) and
**GitHub Packages** (via the `Publish GitHub Packages` workflow). See
[docs/packages.md](docs/packages.md#release-flow) for the release flow, required
secrets, and how consumers provision the optional render binaries.

## Documentation

- [Presentation site](site/index.html)
- [Docs home](docs/index.md)
- [Getting started](docs/getting-started.md)
- [Concepts](docs/concepts.md)
- [Tutorial: Build your first Kavio video](docs/tutorial-first-video.md)
- [CLI reference](docs/cli.md)
- [Template authoring](docs/template-authoring.md)
- [Animation](docs/animation.md)
- [Kavio JSON schema](docs/schema.md)
- [Builder SDK](docs/builder.md)
- [Browser preview](docs/preview.md)
- [Render pipeline](docs/render-pipeline.md)
- [Rendering status](docs/rendering.md)
- [MCP server, skill, and agent tools](docs/mcp.md)
- [API reference](docs/api-reference.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Package API overview](docs/packages.md)
- [Examples](docs/examples.md)
- [MVP demo fixture](docs/demo.md)

## Motion Demos

The site includes a tracked 30-second landscape motion reel so it can be viewed
directly from GitHub or the presentation site:

- [Landscape all-motions MP4](site/assets/examples/kavio-all-motions-landscape.mp4)
- [Examples page with GIF previews and code snippets](site/examples.html#motion-gifs)

Regenerate the vertical and landscape demo compositions from the self-promo site
screenshots:

```bash
corepack pnpm --filter @kitsra/kavio-example-kavio-promo run capture-site
corepack pnpm --filter @kitsra/kavio-example-kavio-promo run emit-motion-demo
corepack pnpm --filter @kitsra/kavio-example-kavio-promo run emit-motion-demo:landscape
node packages/cli/dist/index.js render examples/kavio-promo/generated/all-motions-demo-landscape.json --export kavio-all-motions-landscape --out renders/kavio-all-motions-landscape
```

## Packages

- `@kitsra/kavio-schema`: JSON Schema, shared types, validation, and migration scaffold.
- `@kitsra/kavio-core`: pure timeline evaluation, frame math, easing, prop resolution,
  layout, captions, and resource limits.
- `@kitsra/kavio-builder`: TypeScript authoring SDK that outputs canonical Kavio JSON.
- `@kitsra/kavio-browser-renderer`: browser preview and DOM rendering runtime.
- `@kitsra/kavio-render-worker`: browser-driver contracts, frame capture helpers,
  batch expansion, metadata, and cleanup primitives.
- `@kitsra/kavio-ffmpeg`: inspectable FFmpeg plan construction.
- `@kitsra/kavio-render`: render execution layer (PlaywrightDriver, FFmpeg runner,
  pure command assembly, single and batch rendering).
- `@kitsra/kavio-cli`: local command line for validation, inspection, migration,
  preview, and rendering.
- `@kitsra/kavio-mcp`: Model Context Protocol server plus Anthropic/OpenAI/Gemini tool
  adapters so AI agents can author, validate, plan, and render Kavio videos.

## AI Agents

`@kitsra/kavio-mcp` exposes Kavio to AI agents as a Model Context Protocol server plus
generated per-provider tool schemas, all from a single tool catalog.

Run the server (stdio) in an MCP host:

```jsonc
{ "mcpServers": { "kavio": { "command": "kavio-mcp" } } }
```

- Tools: `validate_composition`, `inspect_composition`, `migrate_composition`,
  `resolve_props`, `list_export_presets`, `plan_render` (pure, always
  available), and `render`.
- Resources: the JSON Schema, export presets, a worked example, and the enum
  reference.
- Prompts: `author_kavio_video`, `repair_kavio_json`, and `adapt_for_platform`.

Repair loop: the model calls `validate_composition`, receives path-keyed errors,
and fixes exactly those paths (see the `repair_kavio_json` prompt).

For non-MCP agents, emit provider tool schemas from the same catalog:

```bash
kavio-mcp emit-adapters --out ./tools
# writes anthropic.tools.json, openai.tools.json, gemini.tools.json
```

For agents that support portable skills but do not want to configure an MCP
server, install the generic Kavio skill from the published package:

```bash
pnpm dlx @kitsra/kavio-mcp emit-skill --out ./skills
# or: pnpx @kitsra/kavio-mcp emit-skill --out ./skills
```

This writes `./skills/kavio-ai/SKILL.md`, a vendor-neutral local CLI/schema
repair loop for authoring, validating, inspecting, previewing, and rendering
Kavio compositions. The repo also includes a portable plugin bundle at
`plugins/kavio-ai` with the same skill plus Codex, Claude, Gemini CLI, and
Antigravity plugin/extension manifests for local plugin-based consumers.

See [docs/mcp.md](docs/mcp.md) for setup details, tool input shapes,
resources, prompts, skill/plugin usage, adapter generation, and render safety
notes.

## Repository Layout

```text
docs/                  User docs, architecture notes, and historical planning docs
examples/              Example compositions and authoring samples
packages/              npm workspace packages
  schema/              Canonical schema and validation
  core/                Timeline evaluation primitives
  builder/             TypeScript builder SDK
  browser-renderer/    Browser runtime
  render-worker/       Browser automation and frame capture contracts
  ffmpeg/              Media planning
  render/              Render execution (browser capture + FFmpeg)
  cli/                 Local command-line interface
  mcp/                 MCP server and provider tool adapters
```

## Supply Chain Posture

This repo is configured for pnpm with `minimumReleaseAge=4320`. Do not add or
upgrade dependencies with clients that bypass the age gate. See
[SECURITY.md](SECURITY.md) for the project security model.

## License

Kavio is source-available under the Elastic License 2.0 (`Elastic-2.0`). The
license allows use, modification, derivative works, and redistribution subject
to its terms, including limits on offering Kavio itself as a hosted or managed
service. It is not an OSI open source license. See [LICENSE](LICENSE).
