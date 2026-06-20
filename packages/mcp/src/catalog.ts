import {
  inspectComposition,
  listExportPresets,
  migrateComposition,
  planRender,
  renderHandler,
  resolveProps,
  validateComposition,
  type RenderHandlerDeps
} from "./handlers.js";
import { prompts } from "./prompts.js";
import { resources } from "./resources.js";
import type { Catalog, JsonSchema, ToolDefinition } from "./types.js";

export interface CreateCatalogOptions {
  render?: RenderHandlerDeps;
}

const documentSchema: JsonSchema = { type: "object", description: "A Kavio composition document." };

function documentInput(extra: Record<string, JsonSchema> = {}): JsonSchema {
  return {
    type: "object",
    properties: { document: documentSchema, ...extra },
    required: ["document"],
    additionalProperties: false
  };
}

function batchInput(extra: Record<string, JsonSchema> = {}): JsonSchema {
  return {
    type: "object",
    properties: {
      document: documentSchema,
      props: { type: "object", description: "Prop values for a single render." },
      presets: { type: "array", items: { type: "string" }, description: "Export preset names." },
      rows: { type: "array", description: "Batch prop rows: [{ id?, props? }]." },
      ...extra
    },
    required: ["document"],
    additionalProperties: false
  };
}

/** Build the Kavio tool/resource/prompt catalog (the single source of truth). */
export function createCatalog(options: CreateCatalogOptions = {}): Catalog {
  const renderDeps = options.render ?? {};

  const tools: ToolDefinition[] = [
    {
      name: "validate_composition",
      description: "Validate a Kavio composition; returns path-keyed errors for repair.",
      inputSchema: documentInput(),
      handler: validateComposition
    },
    {
      name: "inspect_composition",
      description: "Summarize a composition: dimensions, fps, duration, counts, and transition overlap windows.",
      inputSchema: documentInput(),
      handler: inspectComposition
    },
    {
      name: "migrate_composition",
      description: "Migrate a composition to the latest Kavio schema version.",
      inputSchema: documentInput(),
      handler: migrateComposition
    },
    {
      name: "resolve_props",
      description: "Resolve {{prop}} placeholders in a composition using the given prop values.",
      inputSchema: documentInput({ props: { type: "object", description: "Prop values." } }),
      handler: resolveProps
    },
    {
      name: "list_export_presets",
      description: "List the standard Kavio social export presets shared with the builder SDK.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: listExportPresets
    },
    {
      name: "plan_render",
      description: "Expand template x rows x presets and assemble the FFmpeg command(s) without rendering. Always available.",
      inputSchema: batchInput(),
      handler: planRender
    },
    {
      name: "render",
      description:
        "Render a composition to MP4 (browser capture + FFmpeg). Returns a BINARY_MISSING error if Chromium/FFmpeg are unavailable.",
      inputSchema: batchInput({ outDir: { type: "string", description: "Output directory (default: renders)." } }),
      handler: (input) => renderHandler(input, renderDeps)
    }
  ];

  return { tools, resources, prompts };
}
