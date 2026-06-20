import type { JsonSchema, ToolDefinition } from "../types.js";

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: JsonSchema;
}

/** Convert the catalog tools to Anthropic tool-use definitions. */
export function toAnthropicTools(tools: readonly ToolDefinition[]): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema
  }));
}
