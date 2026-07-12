---
"@kitsra/kavio-schema": patch
"@kitsra/kavio-core": patch
"@kitsra/kavio-browser-renderer": patch
"@kitsra/kavio-builder": patch
"@kitsra/kavio-render": patch
"@kitsra/kavio-cli": patch
"@kitsra/kavio-mcp": patch
---

Add portable cover, reveal, diagonal-wipe, and grayscale-dissolve transitions
with deterministic browser rendering and equivalent FFmpeg-direct mappings.
Default-count bar wipes can now use FFmpeg-direct, while custom grids retain the
browser fallback. Composition inspection reports browser and native support for
each transition window.
