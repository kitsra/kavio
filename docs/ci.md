# CI

GitHub Actions runs the root verification path on pull requests and pushes to
`main`:

- `corepack pnpm install --frozen-lockfile --ignore-scripts`
- `corepack pnpm run check`
- `corepack pnpm test`

The workflow uses the repository `packageManager` field through Corepack and
requires pnpm `>=10.16.0`, because that is the supported line for the local
`minimumReleaseAge=4320` package-age gate. Dependency lifecycle scripts are not
run during CI install; if a future package requires generated artifacts, commit
or generate them through an explicit reviewed step instead of relying on
postinstall behavior.

Use `corepack pnpm ...` locally as well. Older global pnpm binaries may ignore
the age-gate setting in `.npmrc`, so avoid `npm`, Yarn classic, and unvalidated
global package-manager shims for installs or lockfile changes.
