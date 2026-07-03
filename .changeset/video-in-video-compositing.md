---
"@kitsra/kavio-ffmpeg": minor
"@kitsra/kavio-render": minor
"@kitsra/kavio-browser-renderer": minor
---

Video-in-video compositing. Time-overlapping video layers are no longer concatenated: video layers that don't overlap form the sequential base timeline, and overlapping layers become picture-in-picture planes (new `planVideoPipOverlay`) scaled to the layer's `size`, positioned at its resolved top-left, bounded to its frame window, and stacked in document order under the graphics overlay — so text and graphics composite over any number of simultaneous videos. The render harness now sets `renderVideoLayers: false` (new `BrowserRendererOptions` flag) so video layers are explicitly excluded from browser captures instead of relying on their sources failing to load. Pip position is static (evaluated mid-window); animated video position is not yet supported.
