# Contributing Docs And Examples

Docs and examples are part of the product surface. Keep them accurate, runnable,
and honest about pre-release limits.

## Documentation Rules

- Prefer commands that work from a fresh checkout.
- Use `corepack pnpm`, not npm or Yarn classic.
- Do not mention unpublished packages as installable from npm.
- Say clearly when a feature is demo-only or planned.
- Link to existing docs instead of duplicating long explanations.
- Keep generated files out of git unless they are intentional fixtures.

## Add A New Doc Page

1. Add the Markdown file under `docs/`.
2. Link it from `docs/index.md`.
3. Use relative links.
4. Run a quick link/path scan with `rg`.
5. Run `git diff --check`.

## Add A New Example

Examples should be deterministic and easy to validate.

Recommended structure:

```text
examples/my-example/
  package.json
  tsconfig.json
  src/
```

Only add `package.json` when the example needs scripts. Prefer scripts such as:

- `build`
- `check`
- `emit`
- `validate`
- `render`

## Generated Outputs

Generated render outputs should stay ignored by git. The MVP demo writes MP4
files under:

```text
examples/mvp-demo/renders/
```

Temporary frame files should be deleted after successful render. If an older
demo render leaves SVG/PNG sidecars, remove them:

```bash
find examples/mvp-demo/renders -type f \( -name "*.svg" -o -name "*.png" \) -delete
```

## Verify Changes

Run:

```bash
corepack pnpm run check
corepack pnpm test
git diff --check
```

For demo-output changes, also run:

```bash
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run render
```

Then inspect all three aspect ratios.

## Keep Historical Plans Separate

Historical planning notes live in `docs/plan/`. Current status should be stated
in the relevant user docs, package docs, source, and tests rather than in a
separate task tracker.
