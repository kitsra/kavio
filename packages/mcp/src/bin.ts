#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { toAnthropicTools } from "./adapters/anthropic.js";
import { toGeminiTools } from "./adapters/gemini.js";
import { toOpenAITools } from "./adapters/openai.js";
import { createCatalog } from "./catalog.js";
import { createServer } from "./server.js";

async function emitAdapters(outDir: string): Promise<void> {
  const tools = createCatalog().tools;
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, "anthropic.tools.json"), `${JSON.stringify(toAnthropicTools(tools), null, 2)}\n`);
  await writeFile(resolve(outDir, "openai.tools.json"), `${JSON.stringify(toOpenAITools(tools), null, 2)}\n`);
  await writeFile(resolve(outDir, "gemini.tools.json"), `${JSON.stringify(toGeminiTools(tools), null, 2)}\n`);
}

async function serve(): Promise<void> {
  const server = createServer(createCatalog());
  await server.connect(new StdioServerTransport());
}

async function main(argv: readonly string[]): Promise<void> {
  if (argv[2] === "emit-adapters") {
    const flagIndex = argv.indexOf("--out");
    const outDir = flagIndex >= 0 ? argv[flagIndex + 1] : undefined;
    if (outDir === undefined || outDir.length === 0) {
      process.stderr.write("Usage: kavio-mcp emit-adapters --out <dir>\n");
      process.exitCode = 1;
      return;
    }
    await emitAdapters(outDir);
    process.stdout.write(`Wrote anthropic/openai/gemini tool files to ${outDir}\n`);
    return;
  }

  await serve();
}

void main(process.argv).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
