# PRD Review

The PRD makes sense and is strong enough to start implementation. It has a clear
product wedge, a concrete MVP boundary, a field-level JSON model, and a realistic
rendering strategy that separates authoring, preview, browser capture, FFmpeg,
and future native rendering.

## What Works

- The wedge is honest: Kavio is not differentiated merely by JSON, but by an
  open, portable, self-hostable format with local SDK ergonomics.
- The MVP boundary is now coherent: schema, builder, browser preview, worker,
  FFmpeg, and CLI. React and AI are correctly pushed after the core proves out.
- The data model is implementable. Frames, pixels, anchor behavior, asset maps,
  layer order, props, captions, audio, exports, and errors are specified well
  enough to code against.
- The security section is appropriately serious. SSRF, arbitrary code, renderer
  sandboxing, malicious fonts/SVGs, and resource exhaustion are not afterthoughts.
- The licensing section catches the major commercial landmines around FFmpeg,
  H.264/HEVC, Chromium, and fonts.

## Things To Tighten Before Heavy Implementation

- Avoid the earlier `kve`/`kve-video` naming because it is either taken or
  repetitive. Use Kavio as the product and CLI name, with scoped packages like
  `@kavio/schema` and `@kavio/builder`.
- Pick a DOM/SVG/Canvas strategy for the browser renderer. The PRD leaves this
  open, but it affects text wrapping, captions, visual tests, and future editor
  parity.
- Clarify whether `version: "0.1"` in examples refers to schema version or
  product release version. Use schema version everywhere in JSON fixtures.
- Define initial resource limits numerically in code before rendering exists:
  max frames, max layers, max dimensions, max assets, max prop string length.
- Decide what the CLI command names should be early because examples, docs, and
  tests will orbit around them.
- Confirm open-core licensing. Apache-2.0 is a good default for the core, but
  BSL/source-available is a business decision if cloud free-riding is a concern.

## Recommended Starting Shape

Start by making the JSON format executable:

1. Publish schema and TypeScript type definitions.
2. Implement prop resolution and validation with the shared error contract.
3. Implement pure frame evaluation in `@kavio/core`.
4. Add a small builder SDK that dogfoods the schema.
5. Add examples and golden fixtures before rendering.

Only after this should the browser renderer and FFmpeg worker begin in earnest.
That sequencing keeps product risk low and gives future Python/Rust bindings a
stable contract to target.
