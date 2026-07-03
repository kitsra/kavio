---
"@kitsra/kavio-render": patch
---

Fix: `renderComposition` now resolves declared prop defaults. It previously called `resolveTemplateProps` directly, bypassing the `resolveDocumentProps` defaults merge, so any template prop without an explicit value failed with `PROP_UNRESOLVED` even when the document declared a default.
