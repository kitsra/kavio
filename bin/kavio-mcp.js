#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const entrypoint = resolve(rootDir, "packages/mcp/dist/bin.js");

if (!existsSync(entrypoint)) {
  console.error("Kavio MCP server is not built. Run `corepack pnpm install` and `corepack pnpm run build` first.");
  process.exit(1);
}

await import(entrypoint);
