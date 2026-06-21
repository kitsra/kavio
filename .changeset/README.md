# Changesets

This directory holds [Changesets](https://github.com/changesets/changesets) for
the Kavio workspace. The `@kitsra/kavio-*` publishable packages are versioned in
lockstep (a `fixed` group), so a single changeset bumps them all together.

## Adding a changeset

```bash
corepack pnpm changeset
```

Pick a bump type (`patch` / `minor` / `major`) and write a short summary. Commit
the generated file under `.changeset/`.

## Releasing

On `main`, the **Release** workflow opens (or updates) a "Version Packages" PR
that applies pending changesets and bumps versions. Merging that PR publishes the
packages to npmjs.com and creates a GitHub Release, which in turn triggers the
**Publish GitHub Packages** workflow to mirror the same versions to GitHub
Packages.
