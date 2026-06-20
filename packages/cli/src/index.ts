#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { socialMediaPresets, type SocialMediaPresetDefinition } from "@kavio/builder";
import {
  schemaVersion,
  validateComposition,
  type KavioDocument,
  type KavioError,
  type ValidationResult
} from "@kavio/schema";
import { renderBatch, type RenderBatchInput, type RenderBatchOptions, type RenderBatchRow } from "@kavio/render";

declare const process: {
  argv: string[];
  cwd(): string;
  exitCode?: number;
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
};

type CliCommand = "help" | "validate" | "inspect" | "migrate" | "preview" | "render" | "presets";

interface ParsedArgs {
  command: CliCommand;
  file?: string;
  json: boolean;
  exportName?: string;
  allExports: boolean;
  propsFile?: string;
  batchFile?: string;
  outDir?: string;
  concurrency?: number;
  failFast: boolean;
  continueOnFrameError: boolean;
}

interface CliFailure {
  command: CliCommand | "unknown";
  ok: false;
  errors: KavioError[];
}

interface ValidateOutput {
  command: "validate";
  ok: boolean;
  file: string;
  version?: string;
  errors: KavioError[];
}

interface InspectSummary {
  file: string;
  version: string;
  composition: {
    width: number;
    height: number;
    fps: number;
    durationFrames: number;
    durationSeconds: number;
    background?: string;
    colorSpace?: string;
  };
  props: {
    count: number;
  };
  assets: {
    count: number;
    types: Record<string, number>;
  };
  layers: {
    count: number;
    types: Record<string, number>;
  };
  audio: {
    count: number;
  };
  exports: {
    count: number;
    names: string[];
  };
}

interface InspectOutput {
  command: "inspect";
  ok: true;
  summary: InspectSummary;
}

interface MigrateOutput {
  command: "migrate";
  ok: true;
  file: string;
  changed: boolean;
  fromVersion: string;
  toVersion: string;
  document: unknown;
}

interface PreviewOutput {
  command: "preview";
  ok: true;
  file: string;
  url: string;
  renderer: PreviewRendererStatus;
  summary: InspectSummary;
}

interface PresetsOutput {
  command: "presets";
  ok: true;
  presets: readonly SocialMediaPresetDefinition[];
}

interface PresetOutput {
  command: "presets";
  ok: true;
  preset: SocialMediaPresetDefinition;
}

interface PreviewRendererStatus {
  available: boolean;
  mode: "browser-renderer" | "placeholder";
  reason?: string;
}

interface PreviewAssets {
  renderer: PreviewRendererStatus;
  browserRendererSource?: string;
  coreSource?: string;
}

interface LoadedJson {
  filePath: string;
  document: unknown;
}

const commands = new Set(["validate", "inspect", "migrate", "preview", "render", "presets"]);
const VALUE_FLAGS = new Set(["--export", "--props", "--batch", "--out", "--concurrency"]);

async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseArgs(argv);

  if ("errors" in parsed) {
    emitFailure(parsed, parsed.command === "unknown" ? argv.includes("--json") : false);
    return 1;
  }

  if (parsed.command === "help") {
    writeStdout(helpText());
    return 0;
  }

  if (parsed.command === "presets") {
    return runPresets(parsed.file, parsed.json);
  }

  if (parsed.file === undefined) {
    emitFailure(
      {
        command: parsed.command,
        ok: false,
        errors: [
          cliError(
            "CLI_FILE_REQUIRED",
            "",
            `Missing file argument for kavio ${parsed.command}.`,
            `Usage: kavio ${parsed.command} <file>`
          )
        ]
      },
      parsed.json
    );
    return 1;
  }

  switch (parsed.command) {
    case "validate":
      return await runValidate(parsed.file, parsed.json);
    case "inspect":
      return await runInspect(parsed.file, parsed.json);
    case "migrate":
      return await runMigrate(parsed.file, parsed.json);
    case "preview":
      return await runPreview(parsed.file, parsed.json);
    case "render":
      return await runRender(parsed);
  }

  return 0;
}

function runPresets(name: string | undefined, json: boolean): number {
  if (name !== undefined) {
    const preset = findSocialMediaPreset(name);
    if (preset === undefined) {
      emitFailure(
        {
          command: "presets",
          ok: false,
          errors: [
            cliError(
              "CLI_UNKNOWN_PRESET",
              "",
              `Unknown social media preset: ${name}`,
              `Run kavio presets to list supported preset ids.`
            )
          ]
        },
        json
      );
      return 1;
    }

    if (json) {
      const output: PresetOutput = { command: "presets", ok: true, preset };
      writeJson(output);
    } else {
      writeJson(preset.preset);
    }
    return 0;
  }

  if (json) {
    const output: PresetsOutput = { command: "presets", ok: true, presets: socialMediaPresets };
    writeJson(output);
  } else {
    writeSocialMediaPresets(socialMediaPresets);
  }
  return 0;
}

function parseArgs(argv: readonly string[]): ParsedArgs | CliFailure {
  let json = false;
  let help = false;
  let allExports = false;
  let failFast = false;
  let continueOnFrameError = false;
  let exportName: string | undefined;
  let propsFile: string | undefined;
  let batchFile: string | undefined;
  let outDir: string | undefined;
  let concurrency: number | undefined;
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--all-exports") {
      allExports = true;
      continue;
    }
    if (arg === "--fail-fast") {
      failFast = true;
      continue;
    }
    if (arg === "--continue-on-frame-error") {
      continueOnFrameError = true;
      continue;
    }

    if (VALUE_FLAGS.has(arg)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        return flagFailure(`Option ${arg} requires a value.`);
      }
      index += 1;

      if (arg === "--export") {
        exportName = value;
      } else if (arg === "--props") {
        propsFile = value;
      } else if (arg === "--batch") {
        batchFile = value;
      } else if (arg === "--out") {
        outDir = value;
      } else {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 1) {
          return flagFailure("--concurrency must be a positive integer.");
        }
        concurrency = parsed;
      }
      continue;
    }

    if (arg.startsWith("-")) {
      return flagFailure(`Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  if (help || positional.length === 0) {
    return { command: "help", json, allExports, failFast, continueOnFrameError };
  }

  const [command, file] = positional;

  if (command === undefined || !commands.has(command)) {
    return {
      command: "unknown",
      ok: false,
      errors: [
        cliError(
          "CLI_UNKNOWN_COMMAND",
          "",
          command === undefined ? "Missing command." : `Unknown command: ${command}`,
          "Run kavio --help for supported commands."
        )
      ]
    };
  }

  if (positional.length > 2) {
    return {
      command: command as CliCommand,
      ok: false,
      errors: [
        cliError(
          "CLI_TOO_MANY_ARGUMENTS",
          "",
          `Too many arguments for kavio ${command}.`,
          `Usage: kavio ${command} <file>`
        )
      ]
    };
  }

  const parsed: ParsedArgs = { command: command as CliCommand, json, allExports, failFast, continueOnFrameError };
  if (file !== undefined) {
    parsed.file = file;
  }
  if (exportName !== undefined) {
    parsed.exportName = exportName;
  }
  if (propsFile !== undefined) {
    parsed.propsFile = propsFile;
  }
  if (batchFile !== undefined) {
    parsed.batchFile = batchFile;
  }
  if (outDir !== undefined) {
    parsed.outDir = outDir;
  }
  if (concurrency !== undefined) {
    parsed.concurrency = concurrency;
  }
  return parsed;
}

function flagFailure(message: string): CliFailure {
  return {
    command: "unknown",
    ok: false,
    errors: [cliError("CLI_UNKNOWN_FLAG", "", message, "Run kavio --help for supported options.")]
  };
}

async function runValidate(file: string, json: boolean): Promise<number> {
  const loaded = await loadJson(file);

  if (!loaded.ok) {
    emitFailure({ command: "validate", ok: false, errors: [loaded.error] }, json);
    return 1;
  }

  const validation = validateComposition(loaded.document);
  const output: ValidateOutput = {
    command: "validate",
    ok: validation.ok,
    file: loaded.filePath,
    errors: validation.errors
  };
  const version = readVersion(loaded.document);

  if (version !== undefined) {
    output.version = version;
  }

  if (json) {
    writeJson(output);
  } else if (validation.ok) {
    writeStdout(`Valid Kavio composition: ${loaded.filePath}\n`);
  } else {
    writeValidationErrors("Invalid Kavio composition", loaded.filePath, validation);
  }

  return validation.ok ? 0 : 1;
}

async function runInspect(file: string, json: boolean): Promise<number> {
  const loaded = await loadJson(file);

  if (!loaded.ok) {
    emitFailure({ command: "inspect", ok: false, errors: [loaded.error] }, json);
    return 1;
  }

  const validation = validateComposition(loaded.document);

  if (!validation.ok) {
    if (json) {
      writeJson({
        command: "inspect",
        ok: false,
        file: loaded.filePath,
        errors: validation.errors
      });
    } else {
      writeValidationErrors("Cannot inspect invalid Kavio composition", loaded.filePath, validation);
    }

    return 1;
  }

  const summary = inspectDocument(loaded.filePath, loaded.document as KavioDocument);
  const output: InspectOutput = { command: "inspect", ok: true, summary };

  if (json) {
    writeJson(output);
  } else {
    writeInspection(summary);
  }

  return 0;
}

async function runMigrate(file: string, json: boolean): Promise<number> {
  const loaded = await loadJson(file);

  if (!loaded.ok) {
    emitFailure({ command: "migrate", ok: false, errors: [loaded.error] }, json);
    return 1;
  }

  const version = readVersion(loaded.document);

  if (version === undefined) {
    emitFailure(
      {
        command: "migrate",
        ok: false,
        errors: [
          cliError(
            "CLI_MIGRATION_VERSION_REQUIRED",
            "version",
            "Cannot migrate a document without a string version.",
            `Current supported schema version is ${schemaVersion}.`
          )
        ]
      },
      json
    );
    return 1;
  }

  if (version !== schemaVersion) {
    emitFailure(
      {
        command: "migrate",
        ok: false,
        errors: [
          cliError(
            "CLI_MIGRATION_UNSUPPORTED_VERSION",
            "version",
            `No migration path is available from ${version} to ${schemaVersion}.`,
            "This CLI currently supports the no-op 0.1 to 0.1 migration path."
          )
        ]
      },
      json
    );
    return 1;
  }

  const validation = validateComposition(loaded.document);

  if (!validation.ok) {
    if (json) {
      writeJson({
        command: "migrate",
        ok: false,
        file: loaded.filePath,
        fromVersion: version,
        toVersion: schemaVersion,
        errors: validation.errors
      });
    } else {
      writeValidationErrors("Cannot migrate invalid Kavio composition", loaded.filePath, validation);
    }

    return 1;
  }

  const output: MigrateOutput = {
    command: "migrate",
    ok: true,
    file: loaded.filePath,
    changed: false,
    fromVersion: version,
    toVersion: schemaVersion,
    document: loaded.document
  };

  if (json) {
    writeJson(output);
  } else {
    writeStderr(`No migration needed: ${loaded.filePath} is already schema ${schemaVersion}.\n`);
    writeJson(loaded.document);
  }

  return 0;
}

async function runPreview(file: string, json: boolean): Promise<number> {
  const loaded = await loadJson(file);

  if (!loaded.ok) {
    emitFailure({ command: "preview", ok: false, errors: [loaded.error] }, json);
    return 1;
  }

  const validation = validateComposition(loaded.document);

  if (!validation.ok) {
    if (json) {
      writeJson({
        command: "preview",
        ok: false,
        file: loaded.filePath,
        errors: validation.errors
      });
    } else {
      writeValidationErrors("Cannot preview invalid Kavio composition", loaded.filePath, validation);
    }

    return 1;
  }

  const document = loaded.document as KavioDocument;
  const summary = inspectDocument(loaded.filePath, document);
  const assets = await loadPreviewAssets();
  const server = createServer((request, response) => {
    void servePreviewRequest(request, response, document, summary, assets).catch((error: unknown) => {
      response.statusCode = 500;
      response.setHeader("content-type", "text/plain; charset=utf-8");
      response.end(`Preview server error: ${errorMessage(error)}\n`);
    });
  });
  const port = await listenOnLocalhost(server);
  const url = `http://127.0.0.1:${port}/`;
  const output: PreviewOutput = {
    command: "preview",
    ok: true,
    file: loaded.filePath,
    url,
    renderer: assets.renderer,
    summary
  };

  if (json) {
    writeJson(output);
  } else {
    writeStdout(`Kavio preview: ${url}\n`);
    writeStdout(`Composition: ${loaded.filePath}\n`);
    writeStdout(`Renderer: ${formatPreviewRendererStatus(assets.renderer)}\n`);
    writeStdout("Press Ctrl+C to stop the preview server.\n");
  }

  return 0;
}

async function runRender(parsed: ParsedArgs): Promise<number> {
  const file = parsed.file;
  if (file === undefined) {
    emitFailure(
      {
        command: "render",
        ok: false,
        errors: [cliError("CLI_FILE_REQUIRED", "", "Missing file argument for kavio render.", "Usage: kavio render <file>")]
      },
      parsed.json
    );
    return 1;
  }

  const loaded = await loadJson(file);
  if (!loaded.ok) {
    emitFailure({ command: "render", ok: false, errors: [loaded.error] }, parsed.json);
    return 1;
  }

  const rows = await resolveRenderRows(parsed);
  if (!rows.ok) {
    emitFailure({ command: "render", ok: false, errors: [rows.error] }, parsed.json);
    return 1;
  }

  const input: RenderBatchInput = { template: loaded.document as KavioDocument, rows: rows.rows };
  if (parsed.exportName !== undefined) {
    input.presets = [parsed.exportName];
  }

  const options: RenderBatchOptions = {
    outDir: parsed.outDir ?? "renders",
    failFast: parsed.failFast,
    continueOnFrameError: parsed.continueOnFrameError
  };
  if (parsed.concurrency !== undefined) {
    options.concurrency = parsed.concurrency;
  }

  let results;
  try {
    results = await renderBatch(input, options);
  } catch (error) {
    emitFailure(
      {
        command: "render",
        ok: false,
        errors: [cliError("CLI_RENDER_FAILED", "", errorMessage(error), "Check export preset names and render inputs.")]
      },
      parsed.json
    );
    return 1;
  }

  const succeeded = results.filter((item) => item.result.ok).length;
  const ok = results.length > 0 && succeeded === results.length;

  if (parsed.json) {
    writeJson({
      command: "render",
      ok,
      total: results.length,
      succeeded,
      outputs: results.map((item) =>
        item.result.ok
          ? { id: item.id, outputName: item.outputName, ok: true, outputPath: item.result.outputPath }
          : { id: item.id, outputName: item.outputName, ok: false, errors: item.result.errors }
      )
    });
  } else {
    for (const item of results) {
      if (item.result.ok) {
        writeStdout(`Rendered ${item.result.outputPath}\n`);
      } else {
        writeStderr(`Failed ${item.outputName}:\n`);
        for (const error of item.result.errors) {
          const path = error.path.length > 0 ? ` at ${error.path}` : "";
          writeStderr(`  - [${error.code}]${path} ${error.message}\n`);
        }
      }
    }
    writeStdout(`${succeeded}/${results.length} renders succeeded.\n`);
  }

  return ok ? 0 : 1;
}

async function resolveRenderRows(
  parsed: ParsedArgs
): Promise<{ ok: true; rows: RenderBatchRow[] } | { ok: false; error: KavioError }> {
  if (parsed.batchFile !== undefined) {
    const batch = await loadJson(parsed.batchFile);
    if (!batch.ok) {
      return { ok: false, error: batch.error };
    }
    if (!Array.isArray(batch.document)) {
      return {
        ok: false,
        error: cliError("CLI_BATCH_INVALID", "", "Batch file must be a JSON array of prop rows.", 'Each row is { "id"?: string, "props"?: object }.')
      };
    }
    return { ok: true, rows: batch.document as RenderBatchRow[] };
  }

  if (parsed.propsFile !== undefined) {
    const props = await loadJson(parsed.propsFile);
    if (!props.ok) {
      return { ok: false, error: props.error };
    }
    if (typeof props.document !== "object" || props.document === null || Array.isArray(props.document)) {
      return {
        ok: false,
        error: cliError("CLI_PROPS_INVALID", "", "Props file must be a JSON object.", 'Provide { "propName": value, ... }.')
      };
    }
    const propValues = props.document as NonNullable<RenderBatchRow["props"]>;
    return { ok: true, rows: [{ props: propValues }] };
  }

  return { ok: true, rows: [{}] };
}

async function loadJson(file: string): Promise<{ ok: true } & LoadedJson | { ok: false; error: KavioError }> {
  const filePath = resolve(process.cwd(), file);

  try {
    const source = await readFile(filePath, "utf8");

    try {
      return { ok: true, filePath, document: JSON.parse(source) as unknown };
    } catch (error) {
      return {
        ok: false,
        error: cliError(
          "CLI_JSON_PARSE_FAILED",
          filePath,
          `Failed to parse JSON: ${errorMessage(error)}`,
          "Check the file for invalid JSON syntax."
        )
      };
    }
  } catch (error) {
    return {
      ok: false,
      error: cliError(
        "CLI_FILE_READ_FAILED",
        filePath,
        `Failed to read file: ${errorMessage(error)}`,
        "Check that the path exists and is readable."
      )
    };
  }
}

async function loadPreviewAssets(): Promise<PreviewAssets> {
  const browserRendererUrl = new URL("../../browser-renderer/dist/index.js", import.meta.url);
  const coreUrl = new URL("../../core/dist/index.js", import.meta.url);

  try {
    const [browserRendererSource, coreSource] = await Promise.all([
      readFile(browserRendererUrl, "utf8"),
      readFile(coreUrl, "utf8")
    ]);

    return {
      browserRendererSource,
      coreSource,
      renderer: {
        available: true,
        mode: "browser-renderer"
      }
    };
  } catch (error) {
    return {
      renderer: {
        available: false,
        mode: "placeholder",
        reason: `Browser renderer package output is not available: ${errorMessage(error)}`
      }
    };
  }
}

function listenOnLocalhost(server: Server): Promise<number> {
  return new Promise((resolveListen, rejectListen) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (isListenAddress(address)) {
        resolveListen(address.port);
        return;
      }

      rejectListen(new Error("Preview server did not return a TCP address."));
    });
  });
}

function isListenAddress(value: unknown): value is { port: number } {
  return isRecord(value) && typeof value.port === "number";
}

async function servePreviewRequest(
  request: IncomingMessage,
  response: ServerResponse,
  document: KavioDocument,
  summary: InspectSummary,
  assets: PreviewAssets
): Promise<void> {
  const path = normalizeRequestPath(request.url);

  if (request.method !== undefined && request.method !== "GET" && request.method !== "HEAD") {
    sendText(response, 405, "Method not allowed.\n");
    return;
  }

  if (path === "/" || path === "/index.html") {
    sendHtml(response, renderPreviewHtml(summary, assets.renderer));
    return;
  }

  if (path === "/composition.json") {
    sendJson(response, document);
    return;
  }

  if (path === "/healthz") {
    sendJson(response, {
      ok: true,
      command: "preview",
      renderer: assets.renderer
    });
    return;
  }

  if (path === "/vendor/browser-renderer/index.js" && assets.browserRendererSource !== undefined) {
    sendJavaScript(response, assets.browserRendererSource);
    return;
  }

  if (path === "/vendor/core/index.js" && assets.coreSource !== undefined) {
    sendJavaScript(response, assets.coreSource);
    return;
  }

  sendText(response, 404, "Not found.\n");
}

function normalizeRequestPath(url: string | undefined): string {
  return (url ?? "/").split("?", 1)[0] ?? "/";
}

function inspectDocument(filePath: string, document: KavioDocument): InspectSummary {
  const fps = Number(document.composition.fps);
  const durationSeconds = fps > 0 ? document.composition.durationFrames / fps : 0;
  const composition: InspectSummary["composition"] = {
    width: document.composition.width,
    height: document.composition.height,
    fps,
    durationFrames: document.composition.durationFrames,
    durationSeconds
  };

  if (document.composition.background !== undefined) {
    composition.background = document.composition.background;
  }

  if (document.composition.colorSpace !== undefined) {
    composition.colorSpace = document.composition.colorSpace;
  }

  return {
    file: filePath,
    version: document.version,
    composition,
    props: {
      count: document.props === undefined ? 0 : Object.keys(document.props).length
    },
    assets: {
      count: Object.keys(document.assets).length,
      types: countTypes(Object.values(document.assets))
    },
    layers: {
      count: document.layers.length,
      types: countTypes(document.layers)
    },
    audio: {
      count: document.audio === undefined ? 0 : document.audio.length
    },
    exports: {
      count: document.exports.length,
      names: document.exports.map((entry, index) => readName(entry) ?? `export-${index + 1}`)
    }
  };
}

function countTypes(items: readonly unknown[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of items) {
    const type = readType(item) ?? "unknown";
    counts[type] = (counts[type] ?? 0) + 1;
  }

  return counts;
}

function readVersion(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.version !== "string") {
    return undefined;
  }

  return value.version;
}

function readType(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.type !== "string") {
    return undefined;
  }

  return value.type;
}

function readName(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.name !== "string") {
    return undefined;
  }

  return value.name;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function writeInspection(summary: InspectSummary): void {
  writeStdout(`Kavio composition: ${summary.file}\n`);
  writeStdout(`Version: ${summary.version}\n`);
  writeStdout(
    `Size: ${summary.composition.width}x${summary.composition.height} @ ${summary.composition.fps}fps\n`
  );
  writeStdout(
    `Duration: ${summary.composition.durationFrames} frames (${summary.composition.durationSeconds.toFixed(2)}s)\n`
  );
  writeStdout(`Props: ${summary.props.count}\n`);
  writeStdout(`Assets: ${summary.assets.count}${formatTypeCounts(summary.assets.types)}\n`);
  writeStdout(`Layers: ${summary.layers.count}${formatTypeCounts(summary.layers.types)}\n`);
  writeStdout(`Audio: ${summary.audio.count}\n`);
  writeStdout(`Exports: ${summary.exports.count}\n`);

  for (const exportName of summary.exports.names) {
    writeStdout(`  - ${exportName}\n`);
  }
}

function writeSocialMediaPresets(presets: readonly SocialMediaPresetDefinition[]): void {
  writeStdout("Kavio social media export presets:\n");
  for (const preset of presets) {
    writeStdout(
      `  ${preset.id.padEnd(24)} ${preset.label.padEnd(24)} ${String(preset.width).padStart(4)}x${String(preset.height).padEnd(4)} ${preset.aspectRatio.padEnd(4)} export: ${preset.defaultName}\n`
    );
  }
  writeStdout("\nUse `kavio presets <id>` to print a copy/pasteable export preset JSON object.\n");
  writeStdout("Use `kavio presets --json` to print the full machine-readable preset catalog.\n");
}

function findSocialMediaPreset(name: string): SocialMediaPresetDefinition | undefined {
  const normalized = normalizePresetName(name);
  return socialMediaPresets.find(
    (preset) => normalizePresetName(preset.id) === normalized || normalizePresetName(preset.defaultName) === normalized
  );
}

function normalizePresetName(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[\s_]+/g, "-");
}

function renderPreviewHtml(summary: InspectSummary, renderer: PreviewRendererStatus): string {
  const frameCount = Math.max(1, summary.composition.durationFrames);
  const initialScale = Math.min(1, 720 / summary.composition.height, 960 / summary.composition.width);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kavio Preview</title>
  ${renderer.available ? `<script type="importmap">${escapeHtml(JSON.stringify({ imports: { "@kavio/core": "/vendor/core/index.js" } }))}</script>` : ""}
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #101820;
      color: #f5f7fa;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(260px, 320px) 1fr;
    }
    aside {
      border-right: 1px solid #26313d;
      padding: 20px;
      background: #151f29;
    }
    main {
      display: grid;
      place-items: center;
      min-width: 0;
      padding: 24px;
    }
    h1 {
      margin: 0 0 16px;
      font-size: 20px;
      font-weight: 650;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 12px;
      margin: 0 0 18px;
      font-size: 13px;
    }
    dt {
      color: #a7b3c0;
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .status {
      border: 1px solid #334150;
      padding: 12px;
      background: #101820;
      font-size: 13px;
      line-height: 1.45;
    }
    .viewport {
      display: grid;
      place-items: center;
      max-width: 100%;
      overflow: auto;
    }
    #stage {
      width: ${summary.composition.width}px;
      height: ${summary.composition.height}px;
      transform: scale(${initialScale});
      transform-origin: center;
      background: #0b0f14;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    }
    #placeholder {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 12px;
      padding: 32px;
      text-align: center;
      color: #d9e2ec;
      background:
        linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px),
        linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
        #0b0f14;
      background-size: 48px 48px;
    }
    code {
      color: #b7f7d5;
    }
    @media (max-width: 760px) {
      body {
        grid-template-columns: 1fr;
      }
      aside {
        border-right: 0;
        border-bottom: 1px solid #26313d;
      }
    }
  </style>
</head>
<body>
  <aside>
    <h1>Kavio Preview</h1>
    <dl>
      <dt>File</dt><dd>${escapeHtml(summary.file)}</dd>
      <dt>Version</dt><dd>${escapeHtml(summary.version)}</dd>
      <dt>Size</dt><dd>${summary.composition.width}x${summary.composition.height}</dd>
      <dt>Frames</dt><dd>${summary.composition.durationFrames} @ ${summary.composition.fps}fps</dd>
      <dt>Layers</dt><dd>${summary.layers.count}${escapeHtml(formatTypeCounts(summary.layers.types))}</dd>
      <dt>Assets</dt><dd>${summary.assets.count}${escapeHtml(formatTypeCounts(summary.assets.types))}</dd>
    </dl>
    <div class="status" id="status">${escapeHtml(formatPreviewRendererStatus(renderer))}</div>
  </aside>
  <main>
    <div class="viewport">
      <div id="stage">
        <div id="placeholder">
          <strong>Preview shell ready</strong>
          <span>Loaded ${frameCount} frame${frameCount === 1 ? "" : "s"} from <code>/composition.json</code>.</span>
        </div>
      </div>
    </div>
  </main>
  <script type="application/json" id="kavio-summary">${escapeHtml(JSON.stringify(summary))}</script>
  ${
    renderer.available
      ? `<script type="module">
const status = document.getElementById("status");
const stage = document.getElementById("stage");
try {
  const composition = await fetch("/composition.json").then((response) => response.json());
  const { installBrowserRendererRuntime } = await import("/vendor/browser-renderer/index.js");
  const runtime = installBrowserRendererRuntime({ root: stage });
  await runtime.loadComposition(composition);
  const rendered = await runtime.renderFrame(0);
  status.textContent = "Browser renderer loaded. Showing frame 0 with " + rendered.layers.length + " active layer(s).";
} catch (error) {
  status.textContent = "Preview placeholder active. Browser renderer package output was found, but could not run in this shell: " + String(error instanceof Error ? error.message : error);
}
</script>`
      : ""
  }
</body>
</html>
`;
}

function formatPreviewRendererStatus(renderer: PreviewRendererStatus): string {
  if (renderer.available) {
    return "browser-renderer package output available";
  }

  return renderer.reason === undefined ? "placeholder preview shell" : `placeholder preview shell (${renderer.reason})`;
}

function sendHtml(response: ServerResponse, value: string): void {
  send(response, 200, "text/html; charset=utf-8", value);
}

function sendJson(response: ServerResponse, value: unknown): void {
  send(response, 200, "application/json; charset=utf-8", `${JSON.stringify(value, null, 2)}\n`);
}

function sendJavaScript(response: ServerResponse, value: string): void {
  send(response, 200, "text/javascript; charset=utf-8", value);
}

function sendText(response: ServerResponse, statusCode: number, value: string): void {
  send(response, statusCode, "text/plain; charset=utf-8", value);
}

function send(response: ServerResponse, statusCode: number, contentType: string, value: string): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", contentType);
  response.setHeader("cache-control", "no-store");
  response.end(value);
}

function writeValidationErrors(title: string, filePath: string, validation: ValidationResult): void {
  writeStderr(`${title}: ${filePath}\n`);

  for (const error of validation.errors) {
    const path = error.path.length > 0 ? ` at ${error.path}` : "";
    const hint = error.hint === undefined ? "" : ` Hint: ${error.hint}`;
    writeStderr(`  - [${error.code}]${path} ${error.message}${hint}\n`);
  }
}

function emitFailure(failure: CliFailure, json: boolean): void {
  if (json) {
    writeJson(failure);
    return;
  }

  for (const error of failure.errors) {
    const hint = error.hint === undefined ? "" : `\n${error.hint}`;
    writeStderr(`${error.message}${hint}\n`);
  }
}

function cliError(code: string, path: string, message: string, hint?: string): KavioError {
  const error: KavioError = {
    code,
    severity: "error",
    message,
    path,
    stage: "io",
    retryable: false
  };

  if (hint !== undefined) {
    error.hint = hint;
  }

  return error;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function formatTypeCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);

  if (entries.length === 0) {
    return "";
  }

  return ` (${entries.map(([type, count]) => `${type}: ${count}`).join(", ")})`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function helpText(): string {
  return `Kavio CLI

Usage:
  kavio --help
  kavio [--json] validate <file>
  kavio [--json] inspect <file>
  kavio [--json] migrate <file>
  kavio [--json] preview <file>
  kavio [--json] render <file> [render options]
  kavio [--json] presets [preset-id]

Options:
  --json       Emit machine-readable JSON for CI and repair loops.
  -h, --help   Show this help.

Render options:
  --export <name>            Render one named export preset.
  --all-exports              Render every export preset (default).
  --props <file.json>        Prop values for a single render.
  --batch <file.json>        Array of prop rows -> rows x presets.
  --out <dir>                Output directory (default: renders).
  --concurrency <n>          Parallel jobs (default: 1).
  --fail-fast                Abort the batch on first job failure.
  --continue-on-frame-error  Tolerate per-frame capture failures.

Commands:
  validate     Validate a Kavio composition JSON file.
  inspect      Print a composition summary.
  migrate      Write the latest-schema JSON document to stdout.
  preview      Start a local browser preview server.
  render       Render a composition to MP4 (browser capture + FFmpeg).
  presets      List social media export presets or print one export JSON object.
`;
}

function writeJson(value: unknown): void {
  writeStdout(`${JSON.stringify(value, null, 2)}\n`);
}

function writeStdout(value: string): void {
  process.stdout.write(value);
}

function writeStderr(value: string): void {
  process.stderr.write(value);
}

void main(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    writeStderr(`Unexpected CLI failure: ${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
