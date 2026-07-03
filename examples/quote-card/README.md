# Quote Card Example (Still Image)

A single-frame image template: `durationFrames: 1` with `png` export presets.
It demonstrates Kavio's still-image rendering — the browser captures one frame
and writes the PNG directly, with no FFmpeg involved.

Props:

- `quote` — the quote text (wrapped at the layer width).
- `author` — attribution line.
- `accent` — accent bar color (defaults to `#f2a03d`).

Exports:

- `square-card` — opaque 1080×1080 PNG.
- `story-card` — opaque 1080×1920 PNG.
- `transparent-card` — 1080×1080 PNG with a real alpha channel
  (`background: "transparent"`).

Render from the repository root:

```bash
corepack pnpm run build
echo '{ "quote": "Ship motion as data.", "author": "Kavio" }' > /tmp/quote.json
node packages/cli/dist/index.js render examples/quote-card/composition.json \
  --export square-card --props /tmp/quote.json --out renders/quote-card
```

Batch a CSV-worth of quotes with `--batch` (array of prop rows) to produce one
PNG per row × preset.
