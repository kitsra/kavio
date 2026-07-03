# Concepts

Kavio is built around one portable composition document. Raw JSON, builder SDKs,
batch jobs, preview, and future render services should all agree on that same
document shape.

## Composition

A composition is a timeline plus renderable content:

- `composition`: canvas size, FPS, duration, background, and color space.
- `props`: declared placeholders for reusable templates.
- `assets`: media and font references.
- `layers`: visual timeline items.
- `audio`: timeline-level audio tracks.
- `exports`: target output presets and layout overrides.

## Frames

Kavio timelines are frame-based. A layer is active for:

```text
startFrame <= frame < startFrame + durationFrames
```

This makes validation, preview, and batch rendering deterministic.

## Props

Props turn a composition into a template. A prop can be declared with type,
defaults, validation metadata, and a description. Values are referenced with
double braces:

```json
"text": "{{headline}}"
```

Batch rendering supplies different prop rows to the same template.

## Assets

Assets are named references. Layers point to asset ids rather than repeating
asset URLs everywhere. The MVP asset types are:

- `video`
- `image`
- `audio`
- `font`

## Layers

Layers are ordered visual timeline items. The MVP layer types are:

- `video`
- `image`
- `text`
- `shape`
- `caption`

Common timing and layout fields are shared across layer types. Layer-specific
fields hold text, asset ids, shape styling, captions, and fit behavior.

## Preview Versus Render

Preview is available today through `kavio preview` and
`@kitsra/kavio-browser-renderer`.

Rendering is available through `kavio render` and `@kitsra/kavio-render` for
opaque `mp4`, `webm`, `mov`, `gif`, and transparent `webm`/`mov` outputs. The
current renderer captures browser frames and encodes them with FFmpeg.
`png-sequence` outputs are schema-valid but reserved for a later archive render
path.

## Exports

Exports describe target outputs. A single composition can define reels, square,
and landscape variants. Export presets can override dimensions, FPS, codecs, and
selected layer layout fields.

## Batch Jobs

A batch job combines:

- one template
- one prop row
- one export preset
- one stable output name

The MVP demo expands five rows times three export presets into 15 outputs.

## Package Boundaries

Kavio packages stay deliberately small:

- `@kitsra/kavio-schema`: data contract and validation.
- `@kitsra/kavio-core`: pure frame evaluation.
- `@kitsra/kavio-builder`: TypeScript authoring helpers.
- `@kitsra/kavio-browser-renderer`: browser preview runtime.
- `@kitsra/kavio-render-worker`: render orchestration contracts.
- `@kitsra/kavio-ffmpeg`: inspectable FFmpeg planning.
- `@kitsra/kavio-render`: concrete browser capture and FFmpeg execution.
- `@kitsra/kavio-cli`: local commands.
- `@kitsra/kavio-mcp`: MCP server and provider tool adapters.
