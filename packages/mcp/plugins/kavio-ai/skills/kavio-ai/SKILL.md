---
name: kavio-ai
description: Author, repair, validate, inspect, preview, and render Kavio JSON video compositions without requiring MCP tools. Use when an AI agent is asked to create a Kavio video, fix Kavio composition JSON, adapt a composition for social export presets, use the Kavio CLI instead of an MCP server, or work from a portable vendor-neutral skill workflow.
---

# Kavio AI

## Workflow

Use this vendor-neutral skill to work with Kavio through the local CLI, schema,
and examples when an MCP host is unavailable or the user prefers a plain skill.

1. Read the relevant local references before inventing document shape:
   - `docs/schema.md` for the composition model.
   - `packages/schema/schema/kavio-0.1.schema.json` for the canonical contract.
   - `examples/basic-json/composition.json` for a compact valid example.
   - `docs/template-authoring.md` for reusable template conventions.
   - `docs/animation.md` when using keyframes, timing, transitions, masks, or effects.
2. Draft or edit the composition as JSON or through the TypeScript builder.
3. Validate after every meaningful change:
   ```bash
   node packages/cli/dist/index.js --json validate path/to/composition.json
   ```
4. If validation fails, change only the reported paths unless the user asks for
   a broader redesign. Keep the document valid at each repair step.
5. Inspect valid compositions before previewing or rendering:
   ```bash
   node packages/cli/dist/index.js --json inspect path/to/composition.json
   ```
6. Preview locally when layout, timing, or motion needs visual review:
   ```bash
   node packages/cli/dist/index.js preview path/to/composition.json
   ```
7. Render only when the user wants files produced and the optional browser and
   FFmpeg binaries are already available, or after the user agrees to install
   them through the repo's reviewed commands.
8. For simple static image slideshows, prefer the explicit direct render path:
   ```bash
   node packages/cli/dist/index.js render path/to/composition.json --render-mode ffmpeg-direct
   ```
   Use it only for image-only compositions where every image layer is
   full-frame and either contiguous or represented by one transition track that
   covers the full duration. Supported image motion is limited to linear `fade`
   transition-in/out, exact linear `fade` / `crossfade`
   `transitionFromPrevious` overlaps, plus a simple linear `keyframes.scale`
   push-in from `1`.
   Use normal rendering for text, masks, mixed layouts, `fit: "none"`,
   non-fade transitions, non-linear timing, unsupported keyframes, or any
   composition that the direct path rejects.

## Build And Tooling

- If `packages/cli/dist/index.js` is missing or stale, run:
  ```bash
  corepack pnpm run build
  ```
- Respect the repository package-age gate. Do not add dependencies or run
  alternate package managers to make an agent workflow work.
- Do not run package lifecycle scripts, downloaded binaries, or render-binary
  installers just to inspect a composition. Validation, inspection, presets, and
  most authoring work do not need browser or FFmpeg binaries.
- Use `corepack pnpm run install:render-binaries` only for an explicit render
  workflow that needs local output files.
- To compare an external production render with a Kavio render, use the
  repo-local report helper after both videos already exist:
  ```bash
  node scripts/compare-render-videos.mjs production.mp4 kavio.mp4 --json render-comparison.json --markdown render-comparison.md
  ```
  Add `--reference-time <seconds>` and `--candidate-time <seconds>` when manual
  wall-clock timings are available. The helper needs local `ffprobe` and
  `ffmpeg`; keep source-app render scripts in their own repos.

## Authoring Rules

- Start from the required top-level keys: `version`, `composition`, `props`,
  `assets`, `layers`, `audio`, and `exports`.
- Prefer stable, descriptive ids such as `headline`, `logo`, `background-video`,
  and `cta`. Keep asset ids and layer references in sync.
- Use props for text, URLs, colors, assets, and other values that should vary
  across rows or users. Add `maxLength` to user-facing text props.
- Reserve layout zones for logo, headline, media, CTA, and captions so prop
  changes do not create overlaps.
- Prefer `exports[].layerOverrides` for aspect-ratio-specific layout changes
  instead of duplicating whole compositions.
- Keep layer timing within `composition.durationFrames`; remember layer timing is
  inclusive at `startFrame` and exclusive at `startFrame + durationFrames`.
- Use `node packages/cli/dist/index.js presets` to discover standard social
  export presets, or `--json presets <preset-id>` for copyable JSON.
- Use `--render-mode ffmpeg-direct` only as a performance path for full-frame
  image sequences or supported shape-only compositions. Image sequences may use
  limited production-style motion: linear fade in/out, exact linear
  fade/crossfade `transitionFromPrevious` overlaps, and monotonic scale push-in.
  `fit: "none"` is not supported. It skips browser PNG capture, so unsupported
  motion/layout features will be rejected instead of approximated.
- For reel-style image handoffs, prefer one top-level `tracks` transition
  series with overlapped clips and linear `transitionFromPrevious`
  `fade`/`crossfade`. Do not model those handoffs as adjacent layer
  `transitionOut` / `transitionIn` fade pairs unless a fade-through-background
  dip is explicitly desired; the track path uses FFmpeg `xfade` and is usually
  smoother and faster.
- For zoomed stills, do not loop the image input before FFmpeg `zoompan`; read
  one image frame and let `zoompan=d=<durationFrames>:fps=<fps>` create the
  segment. Looping before `zoompan` expands the segment timeline and can make
  final-duration truncation show the wrong slides.

## Repair Loop

When validation returns errors:

1. Read each error's `path`, `message`, `stage`, and `hint`.
2. Patch only the smallest JSON region that can resolve the error.
3. Re-run `validate` immediately.
4. Run `inspect` after validation passes to catch suspicious duration, export,
   asset, layer, mask, or transition counts.

Do not guess around the schema. If the desired visual cannot be represented by
the current schema, explain the limitation and offer the closest valid Kavio
composition.

## MCP Parity

When an MCP host is available, `docs/mcp.md` describes the richer MCP path:
`validate_composition`, `inspect_composition`, `list_export_presets`,
`plan_render`, and `render`. This skill exists for agents and vendors that can
load portable skills but do not want to configure MCP.
