# @kitsra/kavio-browser-renderer

Browser runtime for previewing and rendering Kavio frames.

## Install

```bash
corepack pnpm add @kitsra/kavio-browser-renderer
```

## What It Does

- Installs the browser renderer runtime.
- Creates preview controllers.
- Renders text, video, image, shape, and caption layers into DOM frames.
- Reuses DOM for deterministic plain-text, image, and shape layers while
  rebuilding videos, captions, animated text, keyframed layers, and transition
  participants for every frame.
- Handles font loading, preview controls, video fit metadata, and subject-crop
  preview positioning.

Use this package for local preview surfaces, editor integrations, and browser
frame capture pipelines.

## Links

- Repository: https://github.com/kitsra/kavio
- Preview docs: https://github.com/kitsra/kavio/blob/main/docs/preview.md
- Package overview: https://github.com/kitsra/kavio/blob/main/docs/packages.md
- License: Elastic-2.0
