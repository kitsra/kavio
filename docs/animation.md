# Animation Guide

Kavio animation starts with frame-based keyframes. The browser preview evaluates
the same timeline primitives that the render pipeline will consume.

Use native `transitionIn` and `transitionOut` presets for common entrances and
exits. Use explicit keyframes when a layer needs bespoke choreography.

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
- `inCirc`, `outCirc`, `inOutCirc`
- `inExpo`, `outExpo`, `inOutExpo`
- `anticipate`, `back`, `inBack`, `outBack`, `inOutBack`
- `inElastic`, `outElastic`, `inOutElastic`
- `inBounce`, `outBounce`, `inOutBounce`
- `cubic-bezier(x1,y1,x2,y2)`

Use `outCubic` for entrances, `inCubic` for exits, and `outBack` sparingly for
CTA or badge motion.

For richer deterministic timing, a keyframe segment or transition can use a
`timing` object instead of only an easing string. Timing types are `tween`,
`spring`, `steps`, `sequence`, and `stagger`.

## Native Transitions

Layer transitions are frame-based and deterministic. They compile to the same
evaluated layer properties as keyframes, so preview and render stay aligned.

```json
{
  "id": "headline",
  "type": "text",
  "text": "Launch day",
  "startFrame": 12,
  "durationFrames": 72,
  "position": { "x": "50%w", "y": 520 },
  "anchor": "center",
  "transitionIn": {
    "type": "slide",
    "direction": "up",
    "durationFrames": 14,
    "easing": "outCubic"
  },
  "transitionOut": {
    "type": "fade",
    "durationFrames": 10,
    "easing": "inCubic"
  }
}
```

Supported transition types:

- `fade`: animates opacity.
- `slide`: offsets `x` or `y` from the resting position. `direction` is the
  visible movement direction.
- `wipe`: reveals or hides the layer with a clipped edge. `direction` is the
  reveal or hide direction.
- `crossfade`: opacity-based, intended for paired layer timing.
- `zoom`: scales a layer in or out for Ken Burns-style clip movement.
- `push`: moves a layer by a full canvas width or height for clip-to-clip pushes.
- `spin` and `rotate`: add local 2D rotation during the transition.
- `flip`: adds a 3D card-flip around `axis: "x"` or `axis: "y"`.
- `blurDissolve`: combines opacity with a blur ramp.
- `colorDissolve`: overlays a color wash, defaulting to white.
- `dip`: overlays a color wash, defaulting to black.
- `iris`: reveals through a centered `circle` or `diamond`.
- `stretch` and `squeeze`: apply non-uniform elastic scale on an axis.
- `clockWipe`: reveals with a deterministic radial clock wedge.
- `barWipe`: reveals with directional parallel bars.
- `gridWipe`: reveals grid cells in directional order.
- `tileReveal`: grows tiles outward from the center.
- `radialBlur` and `zoomBlur`: combine opacity with blur; `zoomBlur` also
  adds scale.
- `bookFlip`: adds a stronger 3D page-like flip.
- `pageCurlLite`: combines a 3D flip, light skew, and non-uniform scale.
- `skewSlide`: combines a short slide with directional skew.
- `expandMask`: reveals through an expanding centered `circle` or `diamond`.
- `letterboxReveal`: opens from horizontal or vertical letterbox bars.
- `filmFlash`: overlays a warm flash wash.
- `cameraWhip`: combines a fast directional move, blur, and skew.
- `cover`: moves the incoming layer over a stationary outgoing layer.
- `reveal`: moves the outgoing layer away from a stationary incoming layer.
- `diagonalWipe`: reveals from `top-left`, `top-right`, `bottom-left`, or
  `bottom-right` via `corner`.
- `grayscaleDissolve`: fades while moving between grayscale and full color.

`slide` and `wipe` support `direction`: `up`, `down`, `left`, or `right`.
`clockWipe`, `barWipe`, `gridWipe`, `skewSlide`, `pageCurlLite`, and
`cameraWhip`, `cover`, and `reveal` also support `direction`. `flip`, `bookFlip`, `pageCurlLite`,
`stretch`, `squeeze`, and `letterboxReveal` support `axis`: `x` or `y`.
`iris` and `expandMask` support `shape`: `circle` or `diamond`. `dip`,
`colorDissolve`, and `filmFlash` support `color`. `barWipe`, `gridWipe`, and
`tileReveal` can use `rows` and `columns` from 1 to 32. `amount` tunes blur
radius, rotation, scale, wash opacity, or mask strength depending on the
transition; `intensity` tunes secondary scale/skew for blur and whip families.
Legacy transitions use `durationFrames` and may set any supported easing. A
transition may instead use a `timing` object; when `durationFrames` is omitted,
the timing duration defines the transition window.

```json
{
  "transitionIn": {
    "type": "fade",
    "timing": {
      "type": "sequence",
      "segments": [
        { "durationFrames": 4, "from": 0, "to": -0.1, "timing": { "type": "tween", "easing": "anticipate" } },
        { "durationFrames": 8, "from": -0.1, "to": 1, "timing": { "type": "spring", "stiffness": 120, "damping": 12 } }
      ]
    }
  }
}
```

The TypeScript builder exposes the same presets:

```ts
import { text, transition } from "@kitsra/kavio-builder";

text("headline", {
  text: "Launch day",
  startFrame: 12,
  durationFrames: 72,
  transitionIn: transition.slide({
    direction: "up",
    durationFrames: 14,
    easing: "outCubic"
  })
}).exit(transition.fade({ durationFrames: 10, easing: "inCubic" }));
```

## Camera Motion

Camera motion is separate from transitions. Use it when a still image, clip, or
composed scene should move during a shot without implying a cut.

The builder exposes:

- `camera.kenBurns(...)`: scale plus optional pan or tilt.
- `camera.pushIn(...)`: scale up over the layer duration.
- `camera.pullBack(...)`: scale down over the layer duration.
- `camera.pan(...)`: horizontal movement, with optional slight scale padding.
- `camera.tilt(...)`: vertical movement, with optional slight scale padding.
- `camera.parallax(...)`: a slow 2D drift plus subtle scale for layered stills
  or clips.
- `camera.orbitLite(...)`: a shallow 2D arc using `x`, `y`, `scale`, and
  `rotation` keyframes.
- `camera.handheld(...)`: seeded micro-jitter compiled into explicit `x`, `y`,
  `rotation`, and optional `scale` keyframes.
- `camera.crashZoom(...)`: fast scale hit with a small overshoot.
- `camera.dollyZoomLite(...)`: scale plus optional counter-framing from
  `subjectAnchor`, approximated with current 2D keyframes.

These helpers compile to ordinary layer `keyframes` for supported numeric
properties such as `scale`, `x`, `y`, and `rotation`. They work on static image
layers without changing the layer type:

```ts
import { camera, image } from "@kitsra/kavio-builder";

image("hero-still", {
  asset: heroStill,
  startFrame: 0,
  durationFrames: 120,
  position: { x: 540, y: 960 },
  anchor: "center",
  size: { width: 1080, height: 1920 },
  fit: "cover",
  keyframes: camera.kenBurns({
    durationFrames: 120,
    direction: "right",
    restingX: 540,
    safeArea: 0.1,
    easing: "inOutCubic"
  })
});
```

Because these helpers compile to ordinary keyframes, their output is inspectable:

```json
{
  "keyframes": {
    "scale": [
      { "frame": 0, "value": 1, "easing": "outCubic" },
      { "frame": 2, "value": 1.336, "easing": "outBack" },
      { "frame": 7, "value": 1.28 }
    ]
  }
}
```

## Cinematic Builder Presets

The first cinematic preset layer is builder-only. It emits existing native
transitions and numeric keyframes, so generated compositions remain portable and
inspectable:

```ts
import { asset, cinematic, image, video } from "@kitsra/kavio-builder";

const hero = asset.image("hero", "{{heroUrl}}");

video({ width: 1080, height: 1920, fps: 30, durationFrames: 120 })
  .assets(hero)
  .add(
    image("hero", {
      asset: hero,
      startFrame: 0,
      durationFrames: 120,
      fit: "cover",
      ...cinematic.kenBurns({
        durationFrames: 90,
        fromScale: 1.03,
        toScale: 1.12
      }),
      ...cinematic.filmFlash({ durationFrames: 6 })
    })
  );
```

Presets for common editorial beats can be used the same way:

```ts
text("title-card", {
  text: "Launch day",
  startFrame: 12,
  durationFrames: 60,
  ...cinematic.titleSequence({ durationFrames: 18 })
});

image("logo", {
  asset: logo,
  startFrame: 84,
  durationFrames: 36,
  fit: "contain",
  ...cinematic.logoSting({ durationFrames: 12 })
});
```

Shipped cinematic helpers:

- `cinematic.zoomPush`: `zoom` in, `push` out.
- `cinematic.whipPan`: quick `push` entrance for energetic cuts.
- `cinematic.filmFlash`: bright `colorDissolve` entrance.
- `cinematic.dreamyBlur`: longer `blurDissolve` entrance.
- `cinematic.broadcastDip`: classic dark `dip` entrance.
- `cinematic.irisOpen`: shape reveal.
- `cinematic.flipCard`: card-flip entrance.
- `cinematic.glitchCut`: stepped skew, opacity, and offset accents.
- `cinematic.lightLeak`: warm color wash with a gentle deterministic drift.
- `cinematic.kenBurns`: scale and optional position keyframes.
- `cinematic.logoSting`: snappy logo scale, subtle rotation, and fade exit.
- `cinematic.productReveal`: wipe entrance plus product-scale polish.
- `cinematic.socialHook`: fast color flash, crash-scale accent, and push exit.
- `cinematic.titleSequence`: title slide entrance, opacity ramp, and slide exit.
- `cinematic.endCard`: dip entrance, subtle settle, and fade exit.

Use `transition.*` for exact primitives and `cinematic.*` when a named editorial
recipe is clearer. Cinematic presets still compile to native Kavio JSON.

## Text Motion Helpers

`@kitsra/kavio-builder` includes a `textMotion` namespace for whole text layer
entrances and safe split-based text fragments:

- `textMotion.rise({ durationFrames, easing, direction })` emits a native
  `slide` entrance plus opacity keyframes. The default direction is `up`.
- `textMotion.blurIn({ durationFrames, easing, amount, intensity })` emits a
  native `blurDissolve` entrance.
- `textMotion.typeOn({ split, durationFrames, staggerFrames })` reveals
  fragments in order. The default split is `char`.
- `textMotion.cascade({ split, durationFrames, staggerFrames, direction })`
  offsets fragments into their resting positions. The default split is `word`.
- `textMotion.scramble({ split, durationFrames, staggerFrames, seed })` draws
  deterministic temporary characters before each fragment resolves. The default
  split is `char`.
- `textMotion.highlightSweep({ split, durationFrames, color })` moves a
  deterministic highlight across fragments. The default split is `word`.
- `textMotion.trackingIn({ split, durationFrames, amount })` visually spreads
  character fragments and settles them into the resting text. The default split
  is `char`.

`rise` and `blurIn` do not add schema fields. They spread into a text layer as
normal `transitionIn` and `keyframes` data:

```ts
text("title", {
  text: "Measured once, rendered once",
  startFrame: 10,
  durationFrames: 60,
  ...textMotion.blurIn({ durationFrames: 12, amount: 18 })
});
```

The split helpers emit a first-class `textMotion` object:

```ts
text("title", {
  text: "Measured once\nrendered once",
  startFrame: 10,
  durationFrames: 60,
  size: { width: 720, height: 160 },
  ...textMotion.cascade({ split: "line", durationFrames: 12, staggerFrames: 3 })
});
```

Supported split modes are `none`, `word`, `char`, and `line`. The browser
renderer reserves layout by drawing fragments inside the final text flow:
spaces and newlines remain real text nodes, and line splitting uses explicit
newlines. Use layer `size` or `textMotion.restingBox` when a template needs a
fixed measured box. Captions remain separate caption layers; accessibility and
caption text should not depend on animated visual fragments.

## Render Support And Budgets

The current native transition set is stable for browser preview, still-frame
browser rendering, and opaque video render planning. Transparent final video,
GIF, PNG sequence export, and future native render paths are marked unsupported
until their render pipelines ship.

Layer `effects` are schema-declared for future renderer work, but the current
evaluator and browser renderer do not apply them. Authors should use native
transitions for supported motion effects and check the MCP
`kavio://motion-support.json` resource before promising target support.

Layer `mask` is stable for the simplest deterministic Phase 8 sources:

- `shape` masks: `rect`, `circle`, and `diamond`
- `asset` masks: declared image assets sampled as `alpha`
- `procedural` masks: seeded `linearGradient`, `radialGradient`, and `scanlines`

The browser renderer applies these with CSS masks. Procedural masks always
require `seed` so future noise and dither reveals can stay frame-addressable.
Optional `resolution` metadata declares the intended sampling size for budget
checks; it does not generate raster data in the current renderer.

The shared mask/source model reserves asset luma masks, video masks, noise,
threshold, dither, light leak, film burn, grain, vignette, and chromatic offset
families for later phases. Those reserved families are experimental or
unsupported in `kavio://motion-support.json` and should not be authored as
stable JSON yet.

Render planning enforces conservative motion budgets after export preset
expansion:

- maximum blur radius from `blurDissolve` transitions or declared blur effects
- maximum simultaneous filtered layers
- maximum simultaneous masked layers
- maximum declared mask source resolution
- maximum kinetic text fragments
- maximum procedural mask pixels
- maximum transition duration

Some cinematic transitions need more than per-layer deterministic transforms:

- `lumaWipe` needs luma asset masks or procedural luminance maps beyond the
  stable alpha/gradient subset.
- `glitch` needs deterministic artifact generation or channel-split rendering.
- True `lightLeak` overlays need procedural or asset-backed overlay layers;
  `cinematic.lightLeak` is currently a stable color-wash/drift recipe.
- `morphCut` needs media analysis and frame synthesis, especially for dialogue.

Keep those as planned transition families until their mask, generated overlay,
or analysis metadata has stable renderer parity.

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
corepack pnpm --filter @kitsra/kavio-example-mvp-demo run render
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
