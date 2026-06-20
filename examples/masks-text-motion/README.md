# Masks And Text Motion

Focused example for layer masks and renderer-backed text motion. It combines a
procedural scanline mask, an inverted shape mask, scramble text, and type-on
caption text.

```bash
node packages/cli/dist/index.js validate examples/masks-text-motion/composition.json
node packages/cli/dist/index.js render examples/masks-text-motion/composition.json --export masks-text-motion --out renders/examples-masks-text-motion
```
