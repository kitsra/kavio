# @kitsra/kavio-builder

TypeScript authoring SDK for generating canonical Kavio JSON.

## Install

```bash
corepack pnpm add @kitsra/kavio-builder
```

## Usage

```ts
import { text, video } from "@kitsra/kavio-builder";

const composition = video({
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 150,
  layers: [
    text({
      id: "headline",
      text: "Hello Kavio",
      startFrame: 0,
      durationFrames: 150
    })
  ]
});
```

The builder includes layer helpers, asset helpers, prop references, keyframes,
native transitions, camera helpers, cinematic helpers, text motion helpers, and
social export presets.

Create a responsive video inset with `pictureInPicture(...)`:

```ts
import { pictureInPicture } from "@kitsra/kavio-builder";

pictureInPicture("guest", {
  asset: guestVideo,
  startFrame: 30,
  durationFrames: 240,
  placement: "bottom-right",
  widthPercent: 30,
  aspectRatio: 4 / 3
});
```

## Links

- Repository: https://github.com/kitsra/kavio
- Builder docs: https://github.com/kitsra/kavio/blob/main/docs/builder.md
- Examples: https://github.com/kitsra/kavio/tree/main/examples
- License: Elastic-2.0
