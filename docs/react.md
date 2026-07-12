# React Rendering

`@kitsra/kavio-react` is an opt-in frame renderer for teams that want to build
visual layers as React components. It does not replace Kavio's JSON timeline:
the `KavioDocument` still owns dimensions, frame rate, duration, assets, audio,
export presets, validation, and FFmpeg execution.

## Install

```bash
corepack pnpm add @kitsra/kavio-react react react-dom
```

React and React DOM are peer dependencies. Browser capture still requires the
optional Playwright runtime described in [Rendering](rendering.md).

## Render A Component

```tsx
import { renderComposition } from "@kitsra/kavio-render";
import {
  createReactPlaywrightDriver,
  useCurrentFrame,
  useVideoConfig
} from "@kitsra/kavio-react";

function Headline({ children }: { children: string }) {
  const frame = useCurrentFrame();
  const { durationFrames } = useVideoConfig();
  const fadeIn = Math.min(1, frame / 12);
  const fadeOut = Math.min(1, (durationFrames - frame) / 12);

  return <h1 style={{ opacity: Math.min(fadeIn, fadeOut) }}>{children}</h1>;
}

const driver = createReactPlaywrightDriver({
  component: Headline,
  props: { children: "Built with Kavio" },
  styles: "body{display:grid;place-items:center}"
});

const result = await renderComposition(document, {
  preset: "main",
  renderMode: "browser-overlay",
  driver,
  captureParallelism: 4
});
```

Set `renderMode: "browser-overlay"` when supplying a React driver. `auto` may
choose FFmpeg-direct for an eligible JSON composition, which intentionally does
not capture custom browser markup.

## Frame API

- `useCurrentFrame()` returns the zero-based frame being rendered.
- `useVideoConfig()` returns `width`, `height`, `fps`, `durationFrames`, and the
  resolved `composition`.
- `createReactFrameRenderer(...)` returns the lower-level deterministic HTML
  callback accepted by `PlaywrightDriver`.
- `createReactPlaywrightDriver(...)` creates a ready-to-use browser driver and
  accepts optional static CSS and Playwright settings.

Components are rendered with `react-dom/server` to static markup for every
frame. Build all visual state from the current frame, props, and video config.
Effects, hydration, event handlers, client-side state, and Remotion APIs do not
run. Images and fonts are awaited before capture; remote asset availability can
still make a render nondeterministic, so prefer stable local or pinned assets.

## Performance

React markup generation and DOM replacement add work to every captured frame.
Use FFmpeg-direct for eligible JSON-only compositions, and use the React path
when component ergonomics or visual flexibility justify browser capture.
`captureParallelism` remains available because this renderer uses the standard
`PlaywrightDriver` contract. An injected React driver makes `renderBatch`
sequential and does not currently use the batch Chromium pool.

## Agent Guidance

When an agent encounters a React component request:

1. Keep timing, exports, base media, and audio in a valid `KavioDocument`.
2. Express frame-dependent visuals through `useCurrentFrame()`.
3. Select `browser-overlay` explicitly and pass the React driver.
4. Prefer static CSS and deterministic props; do not depend on effects.
5. Inspect and test selected frames before running a full video encode.
