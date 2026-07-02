---
"@kitsra/kavio-render": minor
---

Experimental `renderMode: "ffmpeg-direct"` for `renderComposition`: compositions whose layers can be compiled directly into FFmpeg filters (see `getDirectRenderSupport`) render without launching a browser at all. `assembleDirectRenderCommand` builds the command; shape layers compile to `drawbox` filters. Text and asset layers are not yet eligible.
