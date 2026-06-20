# Browser Renderer Architecture

## Strategy

The browser renderer starts as a DOM-first runtime. The public runtime boundary is
`window.__kavio.loadComposition(composition)` plus
`window.__kavio.renderFrame(frame)`, with `renderFrame` producing a complete view
of exactly the requested frame. Runtime code must not start clocks, timers,
animation loops, or read wall-clock APIs; callers drive time only by passing an
integer frame number.

DOM is the first implementation target because it gives the preview path native
text layout, font loading hooks, captions, accessibility inspection, and easy
developer debugging. SVG should be used later for isolated vector-heavy layer
internals when the schema grows past simple rectangles. Canvas should remain
deferred for this package until there is a measured preview need, because it
would make text parity, hit testing, and future editor inspection harder.

## Rendering Model

- `loadComposition` snapshots the JSON composition and returns deterministic
  composition dimensions and timing metadata.
- `renderFrame` validates the explicit frame, evaluates active layers using
  `@kavio/core`, clears the runtime root, and installs a fresh DOM stage for the
  frame.
- Each DOM layer carries `data-kavio-layer-id` and `data-kavio-layer-type` so
  worker tests and future preview tooling can inspect output without relying on
  generated class names.
- Image layers decode assets and apply fit modes in the DOM runtime. Video
  layers render as DOM video elements with fit metadata, and subject crop
  coordinates/keyframes map to `object-position` for browser preview parity.
  FFmpeg remains responsible for deterministic source-pixel export during final
  renders. Font readiness and visual fixtures are part of the current
  deterministic preview/export path.

## Determinism Rules

- No `Date`, `performance.now`, `requestAnimationFrame`, `setTimeout`, or
  playback state may affect frame output.
- No dependency is required for the runtime API scaffold.
- Layer order is derived from composition order with optional `z` applied as a
  CSS stacking hint.
- Any future async asset work must resolve from composition data and requested
  frame only, not from elapsed wall time.

## Preview Controls

Preview controls live outside `renderFrame`. The browser renderer exposes a
dependency-free preview controller for frame scrubbing, frame-step playback,
safe-zone overlays, and selected export-aspect previews. Playback advances only
integer frames and then calls `renderFrame`; the requested frame remains the sole
input to deterministic frame output.
