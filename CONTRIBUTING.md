# Contributing

Thanks for helping build Kavio.

## Development Principles

- Keep the canonical JSON format small, explicit, and versioned.
- Prefer pure functions in `@kitsra/kavio-core`; rendering side effects belong in
  renderer packages.
- Keep preview and export behavior aligned by sharing renderer code.
- Add tests for schema errors, frame evaluation, and migrations as soon as each
  surface exists.
- Avoid dependency additions unless the standard library or current toolchain is
  insufficient.

## Package Manager

Use Corepack pnpm. This repository expects package age gating to remain enabled:

```sh
corepack pnpm config get minimumReleaseAge
```

Do not use npm, Yarn classic, pip, or pipx to add or upgrade dependencies.
