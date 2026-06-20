# Animation Guide

Kavio animation starts with frame-based keyframes. The browser preview evaluates
the same timeline primitives that the render pipeline will consume.

## Animatable Properties

The MVP supports numeric keyframes for:

- `opacity`
- `x`
- `y`
- `scale`
- `rotation`

## Keyframe Shape

```json
{
  "keyframes": {
    "opacity": [
      { "frame": 0, "value": 0 },
      { "frame": 12, "value": 1, "easing": "outQuad" }
    ],
    "y": [
      { "frame": 0, "value": 390 },
      { "frame": 18, "value": 340, "easing": "outCubic" }
    ]
  }
}
```

Frames are local to the layer. If a layer starts at frame `30`, a keyframe at
`0` applies when the composition is at frame `30`.

## Easing

Supported easing values include:

- `linear`
- `inQuad`, `outQuad`, `inOutQuad`
- `inCubic`, `outCubic`, `inOutCubic`
- `inBack`, `outBack`, `inOutBack`
- `cubic-bezier(x1,y1,x2,y2)`

Use `outCubic` for entrances, `inCubic` for exits, and `outBack` sparingly for
CTA or badge motion.

## Keep Motion Layout-Safe

Animated text still needs a reserved resting zone and a reserved motion path.
Avoid moving a headline through metadata, captions, or CTA text.

Good pattern:

- Brand metadata stays at the top.
- Headline enters into the upper/middle content band.
- CTA enters into a lower band.
- Captions stay in a dedicated bottom safe area.
- Decorative shapes move behind the text layers.

Bad pattern:

- Headline and metadata share the same vertical band.
- CTA overlaps captions.
- Caption text grows without a max line count.
- Decorative shapes sit above text in the layer order.

## Multi-Aspect Motion

Motion that works in `1080x1920` may fail in `1080x1080` or `1920x1080`.
Preview each export preset and use `layerOverrides` when needed:

```json
{
  "name": "landscape",
  "width": 1920,
  "height": 1080,
  "layerOverrides": {
    "headline": {
      "position": { "x": 92, "y": 250 },
      "size": { "width": 820 },
      "style": { "fontSize": 66 }
    }
  }
}
```

## Captions

Caption layers can highlight the active line or word. Keep captions inside a
safe area, especially for social formats with UI overlays.

Caption style fields include:

- `fontFamily`
- `fontSize`
- `fontWeight`
- `color`
- `align`
- `maxCharsPerLine`
- `maxLines`
- `background`
- `padding`
- `highlight`

## Demo Renderer Motion

The MVP demo uses the shared Kavio render pipeline and shows:

- moving decorative shapes
- headline entrance
- CTA entrance
- caption entrance

Run:

```bash
corepack pnpm --filter @kavio/example-mvp-demo run render
```

The demo is useful for visual inspection, but real template animation should be
expressed in Kavio JSON keyframes wherever possible.

## Animation Checklist

- Keyframes are sorted by frame.
- Motion starts and ends inside the layer duration.
- Text has enough resting space.
- Motion paths do not cross other readable text.
- Export presets are previewed individually.
- Decorative motion stays behind content.
