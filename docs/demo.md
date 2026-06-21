# MVP Demo Fixture

The MVP demo fixture lives in `examples/mvp-demo`. It builds a JSON-first video
template with placeholders for clips, logo, headline, CTA, captions, music, and a
brand color palette.

The fixture prepares five prop rows and three export presets:

- `reels-9x16` at `1080x1920`
- `square-1x1` at `1080x1080`
- `landscape-16x9` at `1920x1080`

Together they expand to 15 render jobs.

The example uses the shared render pipeline. It prepares deterministic synthetic
video and music assets, reuses the Kavio brand logo, expands the batch rows,
captures browser-rendered frames, and encodes MP4 files with FFmpeg.

Useful commands:

```bash
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run build
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run emit
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run emit:batch
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run emit:expanded
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run validate
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run render
```

`render` writes all 15 outputs to `examples/mvp-demo/renders/mvp-demo`.
