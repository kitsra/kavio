# @kitsra/kavio-react

Opt-in React frame rendering for Kavio's existing Playwright and FFmpeg video
pipeline. Kavio's JSON document remains the source of timing, dimensions,
assets, audio, and exports.

## Install

```bash
corepack pnpm add @kitsra/kavio-react react react-dom
```

## Use

```tsx
import { renderComposition } from "@kitsra/kavio-render";
import {
  createReactPlaywrightDriver,
  useCurrentFrame,
  useVideoConfig
} from "@kitsra/kavio-react";

function Title({ text }: { text: string }) {
  const frame = useCurrentFrame();
  const { durationFrames } = useVideoConfig();
  const opacity = Math.min(1, frame / 12) * Math.min(1, (durationFrames - frame) / 12);
  return <h1 style={{ opacity }}>{text}</h1>;
}

await renderComposition(document, {
  preset: "main",
  renderMode: "browser-overlay",
  driver: createReactPlaywrightDriver({
    component: Title,
    props: { text: "Hello" },
    styles: "body{display:grid;place-items:center}"
  })
});
```

Components are rendered to static markup once per frame. Effects, browser
state, event handlers, hydration, and Remotion APIs are intentionally not
supported. Derive every visual state from `useCurrentFrame()`, props, and
`useVideoConfig()` to keep output deterministic.

## Links

- Repository: https://github.com/kitsra/kavio
- React rendering docs: https://github.com/kitsra/kavio/blob/main/docs/react.md
- Rendering docs: https://github.com/kitsra/kavio/blob/main/docs/rendering.md
- License: Elastic-2.0
