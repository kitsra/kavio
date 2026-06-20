# MCP Server And Agent Tools

`@kavio/mcp` exposes Kavio composition authoring, validation, planning, and
rendering to AI agents. It provides:

- A Model Context Protocol server over stdio.
- A single shared catalog of tools, resources, and prompts.
- Generated Anthropic, OpenAI, and Gemini tool schema files for non-MCP agent
  runtimes.

The catalog is intentionally backed by the same schema, presets, builder, and
render packages used by the CLI. Agent-facing behavior should stay aligned with
local Kavio workflows.

## Install And Run

From this repository:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run build
node packages/mcp/dist/bin.js
```

After the package is published, MCP hosts can run the package binary:

```jsonc
{
  "mcpServers": {
    "kavio": {
      "command": "kavio-mcp"
    }
  }
}
```

The server uses stdio. It does not start an HTTP listener.

## Tools

### `validate_composition`

Validates a Kavio composition document.

Input:

```json
{ "document": { "...": "Kavio composition JSON" } }
```

Returns `{ ok: true, errors: [] }` on success, or path-keyed validation errors
on failure. This is the primary repair-loop tool.

### `inspect_composition`

Returns a compact summary of a valid composition:

- schema version
- width, height, fps, frame count, and seconds
- prop count
- asset, layer, audio, and export counts
- layer and asset type breakdowns
- mask counts, asset-backed mask references, procedural mask seeds, and mask
  resolutions
- transition-series track, clip, and overlap-window summaries
- export names

Use this after generation to help an agent reason about document shape without
reading the entire JSON again.

### `migrate_composition`

Checks whether a composition can be migrated to the current schema version.
Schema `0.1` currently has no historical migration paths, so current-version
documents return `{ changed: false }`.

### `resolve_props`

Resolves `{{prop}}` placeholders using supplied prop values.

Input:

```json
{
  "document": { "...": "Kavio composition JSON" },
  "props": { "headline": "Launch today" }
}
```

Use this before planning or rendering a templated composition when the agent has
a single row of prop values.

### `list_export_presets`

Returns the standard social export presets shared with `@kavio/builder`, such as
Reels, TikTok, Shorts, square feed, and landscape feed presets.

### `plan_render`

Expands `template x rows x presets` without rendering and returns FFmpeg
argument lists for each job. It is pure and does not require Chromium or FFmpeg
binaries.

Input:

```json
{
  "document": { "...": "Kavio composition JSON" },
  "rows": [
    { "id": "a", "props": { "headline": "A" } },
    { "id": "b", "props": { "headline": "B" } }
  ],
  "presets": ["reels"]
}
```

Use this for review, debugging, and agent planning before allowing a real render.

### `render`

Renders a composition through browser frame capture and FFmpeg.

Input:

```json
{
  "document": { "...": "Kavio composition JSON" },
  "rows": [{ "id": "a", "props": { "headline": "A" } }],
  "presets": ["reels"],
  "outDir": "agent-run-001"
}
```

`outDir` is resolved inside the fixed local `renders/` directory. Absolute paths
and `..` escapes are rejected. If `outDir` is omitted, output goes directly under
`renders/`.

Rendering requires the render optional packages and binaries:

- `playwright`
- Playwright Chromium
- `ffmpeg-static` or a system `ffmpeg`

If a binary is unavailable, the tool returns a structured `BINARY_MISSING`
error. Install render binaries explicitly:

```bash
corepack pnpm run install:render-binaries
```

## Resources

The server exposes these resources:

- `kavio://schema/0.1.json`: canonical Kavio JSON Schema.
- `kavio://presets.json`: standard export presets.
- `kavio://examples/basic.json`: minimal valid composition example.
- `kavio://enums.json`: allowed enum values for layer types, asset types,
  export formats, easing names, effect names, mask source names, prop types, and
  related fields.
- `kavio://motion-support.json`: current transition/effect/mask support states
  by render target, plus the motion performance budgets used during planning.

Agents should read the schema and enum resources before authoring new document
shapes, and use the basic example as a compact structural reference.

## Prompts

### `author_kavio_video`

Generates a Kavio composition from a natural-language brief. The prompt directs
the model to use the schema, enum reference, and basic example, then validate and
repair until the document passes.

Arguments:

- `brief` (required)
- `width`
- `height`
- `durationSeconds`

### `repair_kavio_json`

Repairs a composition using the structured errors returned by
`validate_composition`. The prompt asks the model to change only the listed
paths, which keeps repair loops focused.

Arguments:

- `document` (required)
- `errors` (required)

### `adapt_for_platform`

Adapts a composition to a named platform export preset. The prompt encourages
per-export `layerOverrides` when possible so shared layer definitions stay
stable.

Arguments:

- `document` (required)
- `platform` (required)

## Provider Tool Adapters

For agent runtimes that do not speak MCP directly, emit provider-specific tool
schema files from the same catalog:

```bash
node packages/mcp/dist/bin.js emit-adapters --out ./tools
```

This writes:

- `anthropic.tools.json`
- `openai.tools.json`
- `gemini.tools.json`

The adapters are generated from the same tool definitions used by the MCP
server, so descriptions and input schemas stay synchronized.

## Recommended Agent Loop

1. Read `kavio://schema/0.1.json`, `kavio://enums.json`, and
   `kavio://examples/basic.json`.
2. Draft a composition JSON document.
3. Call `validate_composition`.
4. If validation fails, use `repair_kavio_json` and fix only the reported paths.
5. Call `inspect_composition` to confirm dimensions, duration, layers, and
   exports.
6. Call `plan_render` for a no-side-effect render review.
7. Call `render` only after the plan looks correct and local render binaries are
   available.

## Safety Notes

- Treat tool input as untrusted JSON. The MCP render handler constrains
  `outDir` to the local `renders/` directory.
- Prefer `plan_render` during authoring and review. It is deterministic and does
  not touch browser or FFmpeg binaries.
- Do not rely on package lifecycle scripts to install render binaries in CI or
  publishing flows. Install them through explicit reviewed commands.
- Keep dependency installs on the configured Corepack pnpm path so the local
  package-age gate remains active.

## Troubleshooting

`BINARY_MISSING` from `render`:

Run `corepack pnpm run install:render-binaries`, or install a system `ffmpeg`
and Playwright Chromium in the environment where the MCP server runs.

`outDir must stay inside the renders directory`:

Use a relative subdirectory such as `"agent-run-001"`. Do not pass absolute
paths or paths containing `..`.

Adapter JSON is stale:

Rebuild and re-emit adapters:

```bash
corepack pnpm run build
node packages/mcp/dist/bin.js emit-adapters --out ./tools
```

Validation repair keeps changing unrelated fields:

Use the `repair_kavio_json` prompt and pass the exact `errors` array returned by
`validate_composition`.
