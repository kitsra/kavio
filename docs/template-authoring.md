# Template Authoring Guide

Kavio templates should be readable, reusable, and safe to batch. This guide
covers conventions for raw JSON and builder-authored templates.

## Start With The Contract

Every template should declare:

- `version`
- `composition`
- `props`
- `assets`
- `layers`
- `audio`
- `exports`

Keep the document valid at every step:

```bash
node packages/cli/dist/index.js validate path/to/composition.json
```

## Name Things Predictably

Use stable, descriptive ids:

- `headline`
- `logo`
- `background-video`
- `cta-backing`
- `captions`

Avoid ids that encode layout or timing unless that is the purpose of the layer.
For example, prefer `headline` over `top-left-copy`.

## Use Props For Variant Inputs

Declare props for anything a batch row, editor, or API caller should change:

- headlines
- CTA text
- brand colors
- logo URLs
- clip URLs
- caption text
- offer details

Use `maxLength` on user-facing text props. It protects templates from layouts
that cannot fit the content.

## Keep Assets Reusable

Declare assets once and reference them by id:

```json
{
  "assets": {
    "logo": {
      "type": "image",
      "src": "{{logoUrl}}"
    }
  },
  "layers": [
    {
      "id": "logo",
      "type": "image",
      "asset": "logo",
      "startFrame": 0,
      "durationFrames": 150
    }
  ]
}
```

## Reserve Layout Zones

For templates that must survive prop changes, reserve zones for major content:

- Brand/logo area.
- Headline area.
- Media/cutaway area.
- CTA area.
- Caption area.

Do not let two text-heavy layers occupy the same vertical band unless one is
short-lived and intentionally replacing the other.

## Prefer Export Overrides For Aspect Ratios

Keep the base composition coherent, then use `exports[].layerOverrides` for
aspect-specific changes:

```json
{
  "name": "square",
  "format": "mp4",
  "width": 1080,
  "height": 1080,
  "layerOverrides": {
    "headline": {
      "position": { "x": 72, "y": 220 },
      "size": { "width": 936 },
      "style": { "fontSize": 68 }
    }
  }
}
```

This keeps one template portable across reels, square, and landscape outputs.

## Author With The Builder When JSON Gets Repetitive

Raw JSON is useful for inspection and portability. The builder is better when
you need reusable helper functions, shared prop definitions, or generated
variants.

```ts
import { exportPreset, prop, text, video } from "@kavio/builder";

const headline = prop("headline", { type: "string", required: true, maxLength: 80 });

const template = video({
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 150
})
  .props(headline)
  .add(
    text("headline", {
      text: headline,
      startFrame: 0,
      durationFrames: 150,
      position: { x: 88, y: 320 },
      size: { width: 904 }
    })
  )
  .exports(...exportPreset.social({ landscape: false }));
```

## Validate The Expanded Jobs

For batch templates, validate the expanded render jobs, not only the base
template. The MVP demo does this:

```bash
corepack pnpm --filter @kavio/example-mvp-demo run validate
```

## Authoring Checklist

- Text props have length limits.
- Asset ids match layer references.
- Layer ids are unique.
- Layer timing stays within the composition duration.
- Keyframes are sorted.
- Major layout zones do not overlap.
- Export overrides are validated in every target aspect ratio.
- The template can be inspected with `kavio inspect`.
