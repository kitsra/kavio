# Tutorial: Build Your First Kavio Video

This tutorial creates a small Kavio composition, validates it, inspects it, and
opens it in the browser preview. Published npm packages are not available yet,
so commands use the repository workspace.

## 1. Build The Workspace

```bash
corepack pnpm install --ignore-scripts
corepack pnpm run build
```

## 2. Create A Composition

Create `tmp/hello-kavio.json`:

```json
{
  "version": "0.1",
  "composition": {
    "width": 1080,
    "height": 1080,
    "fps": 30,
    "durationFrames": 120,
    "background": "#101820"
  },
  "props": {
    "headline": {
      "type": "string",
      "default": "Hello from Kavio",
      "maxLength": 80
    }
  },
  "assets": {},
  "layers": [
    {
      "id": "accent",
      "type": "shape",
      "startFrame": 0,
      "durationFrames": 120,
      "position": { "x": 0, "y": 0 },
      "size": { "width": 1080, "height": 18 },
      "fill": "#FFB000"
    },
    {
      "id": "headline",
      "type": "text",
      "startFrame": 0,
      "durationFrames": 120,
      "text": "{{headline}}",
      "position": { "x": "50%w", "y": "50%h" },
      "anchor": "center",
      "size": { "width": "78%w" },
      "style": {
        "fontSize": 72,
        "fontWeight": 800,
        "color": "#FFFFFF",
        "align": "center",
        "wrap": true
      },
      "keyframes": {
        "opacity": [
          { "frame": 0, "value": 0 },
          { "frame": 18, "value": 1, "easing": "outQuad" }
        ],
        "y": [
          { "frame": 0, "value": 590 },
          { "frame": 18, "value": 540, "easing": "outCubic" }
        ]
      }
    }
  ],
  "audio": [],
  "exports": [
    {
      "name": "square",
      "format": "mp4",
      "codec": "h264",
      "width": 1080,
      "height": 1080,
      "fps": 30
    }
  ]
}
```

## 3. Validate

```bash
node packages/cli/dist/index.js validate tmp/hello-kavio.json
```

For machine-readable output:

```bash
node packages/cli/dist/index.js --json validate tmp/hello-kavio.json
```

## 4. Inspect

```bash
node packages/cli/dist/index.js inspect tmp/hello-kavio.json
```

The summary should show one shape layer, one text layer, and one export preset.

## 5. Preview

```bash
node packages/cli/dist/index.js preview tmp/hello-kavio.json
```

Open the printed local URL. The preview supports scrubbing, play/pause, safe
zones, and export-aspect selection.

## 6. Next Steps

- Add reusable fields with `props`.
- Add `image`, `caption`, and `shape` layers.
- Add export presets for square, reels, and landscape.
- Move from raw JSON to the TypeScript builder when templates become repetitive.

See [template authoring](template-authoring.md) and
[animation](animation.md).
