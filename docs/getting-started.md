# Getting Started

This guide uses the repository workspace directly. Published npm packages are
not available yet.

## Requirements

- Node.js 22 or newer
- Corepack
- pnpm 10.16 or newer, with the repository age gate respected

Install dependencies with lifecycle scripts disabled:

```bash
corepack pnpm install --ignore-scripts
```

Build all packages:

```bash
corepack pnpm run build
```

Run the full local verification suite:

```bash
corepack pnpm test
```

## Validate A Composition

The smallest useful example is
`examples/basic-json/composition.json`.

```bash
node packages/cli/dist/index.js validate examples/basic-json/composition.json
```

Expected result:

```text
Valid Kavio composition: /absolute/path/to/examples/basic-json/composition.json
```

For machine-readable output:

```bash
node packages/cli/dist/index.js --json validate examples/basic-json/composition.json
```

## Inspect A Composition

```bash
node packages/cli/dist/index.js inspect examples/basic-json/composition.json
```

This prints duration, canvas dimensions, asset counts, layer counts, audio, and
export presets.

## Preview A Composition

```bash
node packages/cli/dist/index.js preview examples/basic-json/composition.json
```

The CLI starts a local server and prints a `http://127.0.0.1:<port>/` URL. Open
that URL in a browser to scrub the frame, play/pause, toggle safe zones, and
preview export-aspect overrides.

Stop the server with `Ctrl+C`.

## Author With TypeScript

The builder example emits the same JSON as the raw JSON fixture:

```bash
corepack pnpm --filter @kavio/example-basic-builder run build
corepack pnpm --filter @kavio/example-basic-builder run emit
```

See [builder.md](builder.md) for SDK usage.

## Try The MVP Demo Fixture

The MVP demo creates one template, five prop rows, and three export presets,
which expand to 15 render jobs.

```bash
corepack pnpm --filter @kavio/example-mvp-demo run build
corepack pnpm --filter @kavio/example-mvp-demo run validate
```

This validates the expanded jobs. To create local demo MP4s through the shared
render pipeline:

```bash
corepack pnpm --filter @kavio/example-mvp-demo run render
```

Local rendering requires the optional Playwright Chromium browser and FFmpeg
binary to be available.

## Current Rendering Limit

`kavio render` supports opaque `mp4`, `webm`, and `mov` exports today.
Schema-valid `gif`, `png-sequence`, and transparent final outputs are reserved
for later render paths and fail clearly if rendered now.
