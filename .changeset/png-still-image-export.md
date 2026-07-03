---
"@kitsra/kavio-schema": minor
"@kitsra/kavio-render": minor
"@kitsra/kavio-render-worker": patch
"@kitsra/kavio-mcp": patch
---

Still-image `png` export format. Export presets accept `format: "png"` with an optional `frame` field selecting the composition frame to capture (default 0, validated against `durationFrames`; codecs are rejected). Rendering captures one browser frame and writes the PNG directly with no FFmpeg step; the stage paints the effective background (preset, then composition), and `background: "transparent"` produces a real alpha channel. Render metadata records null codecs and `not-used` for FFmpeg.
