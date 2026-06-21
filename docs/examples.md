# Examples

The `examples/` workspace contains raw JSON, TypeScript authoring, a batch demo,
and visual fixture material.

## basic-json

Path: `examples/basic-json/composition.json`

Purpose:

- Small raw Kavio JSON composition.
- Demonstrates subject crop metadata on a video layer.
- Includes default social exports for Instagram Reels, TikTok, YouTube Shorts,
  Facebook Reels, square, portrait, and landscape.
- Useful for CLI validation, inspection, and preview.
- Used as the canonical comparison target for the builder example.

Commands:

```bash
corepack pnpm run build
node packages/cli/dist/index.js validate examples/basic-json/composition.json
node packages/cli/dist/index.js inspect examples/basic-json/composition.json
node packages/cli/dist/index.js preview examples/basic-json/composition.json
```

## basic-builder

Path: `examples/basic-builder`

Purpose:

- Shows how to author Kavio JSON with `@kitsra/kavio-builder`.
- Emits JSON equivalent to `examples/basic-json/composition.json`.

Commands:

```bash
corepack pnpm --filter @kitsra/kavio-example-basic-builder run build
corepack pnpm --filter @kitsra/kavio-example-basic-builder run emit
```

The root test suite compares this output with the raw JSON fixture.

## mvp-demo

Path: `examples/mvp-demo`

Purpose:

- Demonstrates one template expanded across multiple prop rows and export
  presets.
- Covers clips, logo, headline, CTA, captions, music, brand colors, and
  export-specific layer overrides.
- Expands to 15 jobs: five rows times three export presets.
- Uses the shared render pipeline for local MP4 samples.

Commands:

```bash
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run build
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run emit
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run emit:batch
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run emit:expanded
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run validate
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run render
```

`render` prepares deterministic demo assets and produces all 15 local MP4
outputs. Local rendering requires the optional Playwright Chromium browser and
FFmpeg binary.

## native-transitions

Path: `examples/native-transitions/composition.json`

Purpose:

- Raw JSON gallery for every current native transition.
- Keeps `transitionIn` examples inspectable without relying on builder helpers.
- Serves as a schema-validation fixture for motion parity work.

Commands:

```bash
corepack pnpm run build
node packages/cli/dist/index.js validate examples/native-transitions/composition.json
node packages/cli/dist/index.js preview examples/native-transitions/composition.json
```

## visual-fixtures

Path: `examples/visual-fixtures/fixed-frame`

Purpose:

- Fixed-frame composition and frame metadata for browser-renderer regression
  testing.
- Intended for future screenshot and golden-frame workflows.

Files:

- `composition.json`
- `frames.json`
- `browser-renderer.dom-snapshot.json`
- `README.md`

## Add A New Example

Prefer examples that can be checked by CI:

- Include a `package.json` only when build scripts are needed.
- Keep generated outputs out of git unless they are intentional fixtures.
- Make the validation command deterministic.
- If the example claims parity with another fixture, add a test or documented
  diff command.
