export const KAVIO_MCP_PACKAGE = "@kavio/mcp";

export { createCatalog, type CreateCatalogOptions } from "./catalog.js";
export type {
  Catalog,
  JsonSchema,
  PromptArgument,
  PromptDefinition,
  ResourceDefinition,
  ToolDefinition,
  ToolResult
} from "./types.js";

export { toAnthropicTools, type AnthropicTool } from "./adapters/anthropic.js";
export { toOpenAITools, type OpenAITool } from "./adapters/openai.js";
export { toGeminiTools, type GeminiFunctionDeclaration, type GeminiTool } from "./adapters/gemini.js";
export { stripForGemini } from "./adapters/sanitize.js";

export { resources } from "./resources.js";
export { prompts } from "./prompts.js";

// Note: server.ts / bin.ts are intentionally NOT re-exported here so that
// library consumers that only want the catalog or adapters do not pull in the
// MCP SDK. The server is reached via the `kavio-mcp` bin.
