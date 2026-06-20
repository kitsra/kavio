# Troubleshooting

This page collects common problems while working with the current Kavio
workspace.

## Command Uses Stale Code

Most example commands run files from `dist/`. Rebuild after editing TypeScript:

```bash
corepack pnpm run build
```

For one example:

```bash
corepack pnpm --filter @kavio/example-mvp-demo run build
```

## Validation Fails

Run JSON mode to get structured errors:

```bash
node packages/cli/dist/index.js --json validate path/to/composition.json
```

Check:

- `version` is `"0.1"`.
- Required composition fields exist.
- Layer ids are unique.
- Layer timing fits inside the composition duration.
- Asset references point to declared assets.
- Props used as `{{name}}` are declared or supplied.
- Keyframes are sorted.

## Preview Does Not Start

Build first:

```bash
corepack pnpm run build
```

Then run:

```bash
node packages/cli/dist/index.js preview examples/basic-json/composition.json
```

If the preview starts in placeholder mode, the built browser-renderer package was
not found by the CLI. Re-run the root build.

## `kavio render` Fails

The render command needs two optional runtime pieces for real video output:
Playwright's Chromium browser and FFmpeg. The default test suite uses fakes and
does not download browser binaries.

Install both render binaries before running real renders:

```bash
corepack pnpm run install:render-binaries
```

For targeted repair, `install:render-ffmpeg` rebuilds the allowlisted
`ffmpeg-static` package and `install:render-browsers` installs Playwright
Chromium.

`gif`, `png-sequence`, and transparent final outputs are not implemented in the
current render path. Use opaque `mp4`, `webm`, or `mov` exports for now.

## FFmpeg Has No `drawtext`

Some FFmpeg builds do not include the `drawtext` filter. Kavio's current render
pipeline does not rely on `drawtext`; text and shapes are captured by the
browser renderer as transparent PNG overlay frames.

To check filters:

```bash
ffmpeg -hide_banner -filters
```

## Generated Sidecars Appear

The render pipeline writes temporary PNG frames under the system temp directory
and should delete them on success and failure. Generated final outputs are
ignored by git.

```bash
find examples/mvp-demo/renders -type f \( -name "*.svg" -o -name "*.png" \) -delete
```

If old demo sidecars exist from earlier renderer experiments, the command above
is safe cleanup.

## Package Install Issues

Use Corepack pnpm:

```bash
corepack pnpm install --ignore-scripts
```

Do not use npm, Yarn classic, pip, pipx, or unvalidated package-manager shims for
dependency adds, upgrades, or lockfile changes in this repo. The repository uses
a pnpm package-age gate through `.npmrc`.

## Tests Fail After Editing Docs

Docs do not usually affect tests, but run the normal path before committing:

```bash
corepack pnpm run check
corepack pnpm test
```

## Text Overlaps In Demo Outputs

Regenerate the current sample outputs:

```bash
corepack pnpm --filter @kavio/example-mvp-demo run render
```

The demo template reserves separate layout zones for headline, CTA, and captions.
If overlap reappears, inspect the generated sample frames for all three aspect
ratios before changing the full render set.
