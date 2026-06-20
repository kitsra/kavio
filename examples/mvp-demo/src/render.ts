import { renderBatch, type RenderBatchInput } from "@kavio/render";
import { prepareDemoAssets } from "./prepare-assets.js";
import { batchManifest, rows, template } from "./fixture.js";

declare const process: {
  argv: string[];
  cwd(): string;
  exitCode?: number;
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
};

/**
 * Render the MVP demo end-to-end via the real pipeline: generate synthetic
 * assets, point each prop row at them, then expand template x rows x presets
 * (5 x 3 = 15 MP4s) through @kavio/render.
 */
async function main(): Promise<number> {
  const outDir = batchManifest.outputDirectory;
  const assets = await prepareDemoAssets();

  const renderRows = rows.map((row) => ({
    ...row,
    props: {
      ...row.props,
      primaryClipUrl: assets.primaryClip,
      secondaryClipUrl: assets.secondaryClip,
      logoUrl: assets.logo,
      musicUrl: assets.music
    }
  }));

  const input: RenderBatchInput = {
    template,
    rows: renderRows,
    presets: [...batchManifest.presets],
    outputNamePrefix: batchManifest.outputNamePrefix
  };

  const results = await renderBatch(input, { outDir });
  const succeeded = results.filter((item) => item.result.ok).length;

  for (const item of results) {
    if (item.result.ok) {
      process.stdout.write(`Rendered ${item.result.outputPath}\n`);
    } else {
      process.stderr.write(`Failed ${item.outputName}: ${item.result.errors.map((error) => error.code).join(", ")}\n`);
    }
  }

  process.stdout.write(`${succeeded}/${results.length} MVP demo renders succeeded.\n`);
  return succeeded === results.length ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${formatError(error)}\n`);
    process.exitCode = 1;
  });

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const value = error as { code?: unknown; message?: unknown; hint?: unknown };
    const code = typeof value.code === "string" ? `[${value.code}] ` : "";
    const message = typeof value.message === "string" ? value.message : JSON.stringify(error);
    const hint = typeof value.hint === "string" ? `\n${value.hint}` : "";
    return `${code}${message}${hint}`;
  }
  return String(error);
}
