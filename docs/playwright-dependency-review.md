# Playwright Dependency Review

This review records the browser automation dependency decision. It began as a
pre-install review for `@kavio/render-worker`; the concrete Playwright
implementation now lives in `@kavio/render`.

## Decision

- Package: `playwright`
- Intended consumer: `PlaywrightDriver` implementation in `@kavio/render`
- Install status: installed as an optional dependency of `@kavio/render`
- Version policy: newest stable version allowed by the repository's configured
  pnpm package-age gate

## Supply-Chain Controls

The repository is configured with `minimumReleaseAge=4320`, so package
resolution must use Corepack pnpm from this workspace and accept only versions
eligible under that 30-day age gate. Do not use npm, Yarn classic, pip, pipx, or
other non-age-gated clients to add or resolve Playwright.

If Playwright needs to be upgraded, use a reviewed command such as:

```sh
corepack pnpm add --filter @kavio/render playwright
```

Do not relax `.npmrc`, switch registries, pin an unreviewed tarball URL, or run
remote installer commands to work around age-gate failures. If the newest stable
Playwright release is too new, select the newest stable version accepted by the
age gate or pause for user review.

## Install Behavior To Review

Playwright can download browser binaries during package lifecycle steps. The
render worker needs Chromium for frame capture, but dependency installation
should not rely on implicit postinstall side effects. The repository uses an
explicit browser-binary workflow; keep recording:

- Playwright package version
- Chromium revision
- Browser binary source
- Checksum or provenance metadata where available
- Whether CI installs skip lifecycle scripts

## Runtime Contract

The `@kavio/render-worker` public API defines the driver contract and
deterministic launch metadata. The Playwright-backed driver must:

- open a `KavioDocument`
- render a requested frame as PNG bytes
- close browser resources
- launch Chromium headlessly with the exported deterministic flags
- use `deviceScaleFactor: 1`
- omit the screenshot background for transparent overlay frames
- record the Chromium revision in render metadata

Playwright imports should remain quarantined in `@kavio/render`.
