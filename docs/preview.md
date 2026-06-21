# Browser Preview

Kavio preview is browser-based. It loads a valid composition, evaluates the
timeline with `@kitsra/kavio-core`, and renders visible layers into a DOM stage.

## Start A Preview

Build the workspace first:

```bash
corepack pnpm run build
```

Then run:

```bash
node packages/cli/dist/index.js preview examples/basic-json/composition.json
```

The CLI prints a local URL:

```text
Kavio preview: http://127.0.0.1:53123/
Composition: /absolute/path/to/examples/basic-json/composition.json
Renderer: browser renderer
Press Ctrl+C to stop the preview server.
```

Open the URL in a browser.

## Preview Controls

The current preview UI supports:

- Frame scrubber.
- Play and pause.
- Safe-zone toggle.
- Export-aspect preview when the composition has export presets.

## Runtime API

`@kitsra/kavio-browser-renderer` exposes a DOM runtime for app integrations.

```ts
import { installBrowserRendererRuntime } from "@kitsra/kavio-browser-renderer";

const runtime = installBrowserRendererRuntime({
  document,
  root: document.getElementById("preview-root")!
});

await runtime.loadComposition(composition);
await runtime.renderFrame(42);
```

The runtime is also installed on `window.__kavio` when
`installBrowserRendererRuntime()` is used.

## Programmatic Preview Controller

```ts
import { createBrowserPreviewController } from "@kitsra/kavio-browser-renderer";

const controller = createBrowserPreviewController({
  root: document.getElementById("preview-root")!,
  controlsRoot: document.getElementById("controls-root")!,
  loop: true,
  frameStep: 1
});

await controller.loadComposition(composition);
await controller.setFrame(30);
controller.play();
```

Important methods:

- `loadComposition(composition, options?)`
- `renderFrame(frame?)`
- `setFrame(frame)`
- `step(delta?)`
- `play()`
- `pause()`
- `togglePlayback(force?)`
- `setSafeZonesVisible(visible)`
- `setPreviewExport(selection)`
- `destroy()`

## Rendered Layer Support

The MVP browser renderer supports:

- Text layers.
- Video layers with DOM fit rendering and subject-crop preview positioning.
- Image layers.
- Rect shape layers.
- Caption layers with safe-area placement and word highlighting.
- Font loading through declared font assets where the browser supports
  `FontFace`.

Final MP4 output is handled by the render pipeline, which captures browser
frames and encodes through FFmpeg.

## Visual Fixtures

`examples/visual-fixtures/fixed-frame` contains a composition plus expected
frame metadata for future screenshot and golden-frame tests.
