import { isAbsolute, relative, resolve } from "node:path";
import {
  applyExportPreset,
  collectCompositionResourceLimitInputs,
  collectResourceLimitViolations,
  compileTransitionOverlapWindows,
  resolveTemplateProps
} from "@kavio/core";
import { socialMediaPresets } from "@kavio/builder";
import { assembleRenderCommand, renderBatch, type FfmpegRunner, type RenderBatchOptions } from "@kavio/render";
import { expandRenderBatch, type BrowserDriver, type RenderBatchInput, type RenderBatchRow } from "@kavio/render-worker";
import { schemaVersion, validateComposition as schemaValidate, type KavioDocument, type KavioError } from "@kavio/schema";
import type { ToolResult } from "./types.js";

export const STANDARD_PRESETS = socialMediaPresets;

export function validateComposition(input: unknown): ToolResult {
  const document = readDocument(input);
  if (document.ok === false) {
    return document.result;
  }
  const result = schemaValidate(document.value);
  if (result.ok) {
    return { ok: true, data: { ok: true, errors: [] } };
  }
  return { ok: false, errors: result.errors };
}

export function inspectComposition(input: unknown): ToolResult {
  const document = readDocument(input);
  if (document.ok === false) {
    return document.result;
  }
  const validation = schemaValidate(document.value);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const doc = document.value as KavioDocument;
  const fps = Number(doc.composition.fps);
  return {
    ok: true,
    data: {
      version: doc.version,
      composition: {
        width: doc.composition.width,
        height: doc.composition.height,
        fps,
        durationFrames: doc.composition.durationFrames,
        durationSeconds: fps > 0 ? doc.composition.durationFrames / fps : 0
      },
      props: { count: doc.props === undefined ? 0 : Object.keys(doc.props).length },
      assets: { count: Object.keys(doc.assets).length, types: countTypes(Object.values(doc.assets)) },
      layers: { count: doc.layers.length, types: countTypes(doc.layers) },
      masks: inspectMasks(doc),
      tracks: {
        count: doc.tracks === undefined ? 0 : doc.tracks.length,
        clipCount: doc.tracks === undefined ? 0 : doc.tracks.reduce((total, track) => total + track.clips.length, 0),
        transitionWindows: compileTransitionOverlapWindows(doc.tracks).map((window) => ({
          trackId: window.trackId,
          previousClipId: window.previousClipId,
          previousLayerId: window.previousLayerId,
          nextClipId: window.nextClipId,
          nextLayerId: window.nextLayerId,
          startFrame: window.startFrame,
          endFrame: window.endFrame,
          durationFrames: window.durationFrames,
          transitionType: window.transition.type
        }))
      },
      audio: { count: doc.audio === undefined ? 0 : doc.audio.length },
      exports: {
        count: doc.exports.length,
        names: doc.exports.map((entry, index) => (typeof entry.name === "string" ? entry.name : `export-${index + 1}`))
      }
    }
  };
}

interface MaskSummary {
  count: number;
  shapeCount: number;
  assetMasks: Array<{
    layerId: string;
    asset: string;
    mode: string;
    width?: number;
    height?: number;
  }>;
  proceduralMasks: Array<{
    layerId: string;
    type: string;
    seed: number;
    direction?: string;
    width?: number;
    height?: number;
  }>;
  invertedCount: number;
}

function inspectMasks(document: KavioDocument): MaskSummary {
  const summary: MaskSummary = {
    count: 0,
    shapeCount: 0,
    assetMasks: [],
    proceduralMasks: [],
    invertedCount: 0
  };

  for (const layer of document.layers) {
    const mask = layer.mask;
    if (!mask) {
      continue;
    }

    summary.count += 1;
    if (mask.invert === true) {
      summary.invertedCount += 1;
    }

    switch (mask.source.kind) {
      case "shape":
        summary.shapeCount += 1;
        break;
      case "asset":
        summary.assetMasks.push(withResolution({
          layerId: layer.id,
          asset: mask.source.asset,
          mode: mask.source.mode ?? "alpha"
        }, mask.source.resolution));
        break;
      case "procedural":
        summary.proceduralMasks.push(withResolution({
          layerId: layer.id,
          type: mask.source.type,
          seed: mask.source.seed,
          ...(mask.source.direction === undefined ? {} : { direction: mask.source.direction })
        }, mask.source.resolution));
        break;
    }
  }

  return summary;
}

function withResolution<T extends { width?: number; height?: number }>(
  value: Omit<T, "width" | "height">,
  resolution: { width: number; height: number } | undefined
): T {
  return (
    resolution === undefined
      ? value
      : {
          ...value,
          width: resolution.width,
          height: resolution.height
        }
  ) as T;
}

export function migrateComposition(input: unknown): ToolResult {
  const document = readDocument(input);
  if (document.ok === false) {
    return document.result;
  }
  const version = (document.value as { version?: unknown }).version;
  if (typeof version !== "string") {
    return { ok: false, errors: [mcpError("Document is missing a string version.")] };
  }
  if (version !== schemaVersion) {
    return {
      ok: false,
      errors: [mcpError(`No migration path from ${version} to ${schemaVersion}.`, "MCP_MIGRATION_UNSUPPORTED")]
    };
  }
  return { ok: true, data: { changed: false, fromVersion: version, toVersion: schemaVersion, document: document.value } };
}

export function resolveProps(input: unknown): ToolResult {
  if (!isRecord(input) || !("document" in input)) {
    return { ok: false, errors: [mcpError("Expected { document, props } input.")] };
  }
  const props = (input as { props?: unknown }).props;
  const values = isRecord(props) ? (props as Record<string, unknown>) : {};
  const resolution = resolveTemplateProps((input as { document: unknown }).document, values);
  if (resolution.ok) {
    return { ok: true, data: resolution.value };
  }
  return { ok: false, errors: resolution.errors };
}

export function listExportPresets(_input: unknown): ToolResult {
  return { ok: true, data: STANDARD_PRESETS.map((preset) => ({ ...preset, preset: { ...preset.preset } })) };
}

export function planRender(input: unknown): ToolResult {
  const parsed = parseBatchInput(input);
  if (parsed.ok === false) {
    return { ok: false, errors: [parsed.error] };
  }

  const jobs: Array<{ id: string; outputName: string; preset: unknown; ffmpegArgs: string[] }> = [];
  let expanded;
  try {
    expanded = expandRenderBatch(parsed.batchInput);
  } catch (error) {
    return { ok: false, errors: toErrors(error, "MCP_PLAN_FAILED") };
  }

  for (const job of expanded) {
    const resolution = resolveTemplateProps(job.document, job.props);
    if (!resolution.ok) {
      return { ok: false, errors: resolution.errors };
    }
    try {
      const view = applyExportPreset(resolution.value, job.preset);
      const violations = collectResourceLimitViolations(collectCompositionResourceLimitInputs(view));
      if (violations.length > 0) {
        return { ok: false, errors: violations };
      }
      const ffmpegArgs = assembleRenderCommand({
        view,
        preset: job.preset,
        framePattern: "overlay-%05d.png",
        outputPath: job.outputName
      });
      jobs.push({ id: job.id, outputName: job.outputName, preset: job.preset, ffmpegArgs });
    } catch (error) {
      return { ok: false, errors: toErrors(error, "MCP_PLAN_FAILED") };
    }
  }

  return { ok: true, data: { jobs } };
}

export interface RenderHandlerDeps {
  driver?: BrowserDriver;
  ffmpegRunner?: FfmpegRunner;
}

export async function renderHandler(input: unknown, deps: RenderHandlerDeps = {}): Promise<ToolResult> {
  const parsed = parseBatchInput(input);
  if (parsed.ok === false) {
    return { ok: false, errors: [parsed.error] };
  }
  const outDir = safeRenderOutDir(isRecord(input) ? input.outDir : undefined);
  if (outDir.ok === false) {
    return { ok: false, errors: [outDir.error] };
  }

  const options: RenderBatchOptions = { outDir: outDir.value };
  if (deps.driver !== undefined) {
    options.driver = deps.driver;
  }
  if (deps.ffmpegRunner !== undefined) {
    options.ffmpegRunner = deps.ffmpegRunner;
  }

  let results;
  try {
    results = await renderBatch(parsed.batchInput, options);
  } catch (error) {
    return { ok: false, errors: toErrors(error, "RENDER_FAILED") };
  }

  const outputs = results.map((item) =>
    item.result.ok
      ? { id: item.id, outputName: item.outputName, ok: true, outputPath: item.result.outputPath, metadata: item.result.metadata }
      : { id: item.id, outputName: item.outputName, ok: false, errors: item.result.errors }
  );
  const allOk = results.length > 0 && results.every((item) => item.result.ok);
  if (allOk) {
    return { ok: true, data: { outputs } };
  }
  const failures = results.flatMap((item) => (item.result.ok ? [] : item.result.errors));
  return { ok: false, data: { outputs }, errors: failures };
}

function readDocument(input: unknown): { ok: true; value: unknown } | { ok: false; result: ToolResult } {
  if (!isRecord(input) || !("document" in input)) {
    return { ok: false, result: { ok: false, errors: [mcpError("Expected { document } input.")] } };
  }
  return { ok: true, value: (input as { document: unknown }).document };
}

function parseBatchInput(input: unknown): { ok: true; batchInput: RenderBatchInput } | { ok: false; error: KavioError } {
  if (!isRecord(input) || !("document" in input)) {
    return { ok: false, error: mcpError("Expected { document } input.") };
  }

  const document = input.document as KavioDocument;
  const rowsInput = input.rows;
  const presetsInput = input.presets;
  const propsInput = input.props;
  const rows: RenderBatchRow[] = Array.isArray(rowsInput)
    ? (rowsInput as RenderBatchRow[])
    : [{ props: (isRecord(propsInput) ? propsInput : {}) as NonNullable<RenderBatchRow["props"]> }];

  const batchInput: RenderBatchInput = { template: document, rows };
  if (Array.isArray(presetsInput)) {
    batchInput.presets = presetsInput as NonNullable<RenderBatchInput["presets"]>;
  }

  return { ok: true, batchInput };
}

function safeRenderOutDir(input: unknown): { ok: true; value: string } | { ok: false; error: KavioError } {
  const base = resolve("renders");
  const requested = typeof input === "string" && input.length > 0 ? input : ".";
  const outDir = resolve(base, requested);
  const relativePath = relative(base, outDir);
  if (relativePath === ".." || relativePath.startsWith("../") || isAbsolute(relativePath)) {
    return {
      ok: false,
      error: mcpError("outDir must stay inside the renders directory.", "MCP_INPUT_INVALID")
    };
  }

  return { ok: true, value: outDir };
}

function countTypes(items: readonly unknown[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const type = isRecord(item) && typeof item.type === "string" ? item.type : "unknown";
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

function mcpError(message: string, code = "MCP_INPUT_INVALID"): KavioError {
  return { code, severity: "error", message, path: "", stage: "validation", retryable: false };
}

function toErrors(error: unknown, fallbackCode: string): KavioError[] {
  if (isRecord(error) && typeof error.code === "string" && typeof error.stage === "string") {
    return [error as unknown as KavioError];
  }
  return [mcpError(error instanceof Error ? error.message : String(error), fallbackCode)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
