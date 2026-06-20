# Transition Series

Focused example for composition-level `tracks` and `transitionFromPrevious`.
The outgoing and incoming panels overlap for 12 frames and render through the
same push transition window.

```bash
node packages/cli/dist/index.js validate examples/transition-series/composition.json
node packages/cli/dist/index.js render examples/transition-series/composition.json --export transition-series --out renders/examples-transition-series
```
