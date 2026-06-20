# Native Transitions Example

This raw JSON fixture covers every current native `transitionIn` preset.

Use it for schema validation, browser preview spot checks, and future render
parity work:

```bash
corepack pnpm run build
node packages/cli/dist/index.js validate examples/native-transitions/composition.json
node packages/cli/dist/index.js preview examples/native-transitions/composition.json
```
