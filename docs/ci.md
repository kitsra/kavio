# CI

GitHub Actions runs the root verification path on pull requests and pushes to
`main`:

- `corepack pnpm install --frozen-lockfile --ignore-scripts`
- `corepack pnpm run check`
- `corepack pnpm test`
- `corepack pnpm run pack:dry`

The Render E2E workflow additionally exercises real Chromium + FFmpeg rendering
on pull requests and `main` pushes, skipping documentation-only changes
(`docs/`, `site/`, and Markdown files).

Both workflows share the `.github/actions/setup` composite action, which caches
the pnpm store keyed on `pnpm-lock.yaml`. Render E2E also caches the Playwright
Chromium download keyed on `packages/render/package.json`; on a cache hit only
the OS-level dependencies are installed.

The workflow uses the repository `packageManager` field through Corepack and
requires pnpm `>=10.16.0`, because that is the supported line for the local
`minimumReleaseAge=4320` package-age gate. Dependency lifecycle scripts are not
run during CI install; if a future package requires generated artifacts, commit
or generate them through an explicit reviewed step instead of relying on
postinstall behavior.

Use `corepack pnpm ...` locally as well. Older global pnpm binaries may ignore
the age-gate setting in `.npmrc`, so avoid `npm`, Yarn classic, and unvalidated
global package-manager shims for installs or lockfile changes.
