# Video-in-Video Example (Picture-in-Picture)

Two time-overlapping video layers plus a text overlay:

- `main` — full-frame base video for the whole composition.
- `inset` — the same source trimmed 150 frames ahead, playing simultaneously
  in a 360×640 plane at the top right between frames 30 and 120.
- `caption` — text composited over both videos (prop `caption`).

Time-overlapping video layers are compiled into FFmpeg picture-in-picture
overlay planes (scaled to the layer `size`, positioned at its resolved
top-left, bounded to its frame window) and stacked in document order under the
browser graphics overlay. Non-overlapping video layers still concatenate
sequentially. Pip position is static per layer; keyframed pip motion is not
supported yet.

Render from the repository root (the asset path is repo-relative):

```bash
corepack pnpm run build
node packages/cli/dist/index.js render examples/video-pip/composition.json \
  --export pip-landscape --out renders/video-pip
```
