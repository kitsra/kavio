# CLI Reference

The Kavio CLI lives in `@kavio/cli`. In this repository, run it from the built
workspace:

```bash
corepack pnpm run build
node packages/cli/dist/index.js --help
```

When published, the binary name is expected to be `kavio`.

## Commands

```text
kavio --help
kavio [--json] validate <file>
kavio [--json] inspect <file>
kavio [--json] migrate <file>
kavio [--json] preview <file>
kavio [--json] presets [preset-id]
kavio [--json] render <file> [render options]
```

`render` supports opaque `mp4`, `webm`, and `mov` exports. It requires the
optional Playwright Chromium browser and FFmpeg binary for real video output.
Install render binaries explicitly when you want local renders:

```bash
corepack pnpm run install:render-binaries
```

## validate

Validates a Kavio JSON composition.

```bash
node packages/cli/dist/index.js validate examples/basic-json/composition.json
```

Exit behavior:

- `0` when the file is valid.
- Non-zero when the file cannot be read, cannot be parsed, or fails validation.

JSON output:

```bash
node packages/cli/dist/index.js --json validate examples/basic-json/composition.json
```

The JSON response includes `ok`, `file`, `version`, and a structured `errors`
array.

## inspect

Prints a composition summary.

```bash
node packages/cli/dist/index.js inspect examples/basic-json/composition.json
```

The summary includes:

- Composition dimensions, FPS, duration in frames, and duration in seconds.
- Prop count.
- Asset count and asset-type breakdown.
- Layer count and layer-type breakdown.
- Audio count.
- Export preset count and names.

Use `--json` for machine-readable summaries in CI and repair loops.

## presets

Lists social media export presets, or prints one copy/pasteable export preset
object for raw JSON editing.

```bash
node packages/cli/dist/index.js presets
node packages/cli/dist/index.js presets instagram-reels
node packages/cli/dist/index.js --json presets youtube-shorts
```

Paste a single-preset response into a composition's `exports` array, then render
by name:

```bash
node packages/cli/dist/index.js render composition.json --export youtube-shorts-9x16
```

## migrate

Writes a latest-schema JSON document to stdout.

```bash
node packages/cli/dist/index.js migrate examples/basic-json/composition.json
```

Schema `0.1` currently has only a no-op `0.1 -> 0.1` migration path. Unsupported
versions fail clearly instead of guessing.

## preview

Starts a local browser preview server for a valid composition.

```bash
node packages/cli/dist/index.js preview examples/basic-json/composition.json
```

The command prints:

- The local preview URL.
- The composition file path.
- Whether the built browser renderer was loaded.

The preview server keeps running until stopped with `Ctrl+C`.

## render

Renders a composition through browser frame capture and FFmpeg:

```bash
node packages/cli/dist/index.js render examples/basic-json/composition.json
```

Useful options:

- `--export <name>` renders one named export preset.
- `--all-exports` renders every export preset, which is also the default when
  `--export` is omitted.
- `--batch <file.json>` renders prop rows times selected presets.
- `--props <file.json>` renders one prop set.
- `--out <dir>` changes the output directory.
- `--concurrency <n>` renders multiple jobs in parallel.

Schema-valid `gif`, `png-sequence`, and transparent final outputs are reserved
for later render paths and fail clearly in the current renderer.

## JSON Mode

Place `--json` before the command:

```bash
node packages/cli/dist/index.js --json inspect examples/basic-json/composition.json
```

JSON mode is intended for CI, AI repair loops, and editor integrations.

## Errors

CLI errors use the same shape as schema errors:

```json
{
  "code": "CLI_FILE_READ_FAILED",
  "severity": "error",
  "message": "Failed to read file: ...",
  "path": "/absolute/path",
  "stage": "io",
  "hint": "Check that the path exists and is readable.",
  "retryable": false
}
```
