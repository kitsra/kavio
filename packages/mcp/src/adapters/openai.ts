import type { JsonSchema, ToolDefinition } from "../types.js";

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

/** Convert the catalog tools to OpenAI function-calling definitions. */
export function toOpenAITools(tools: readonly ToolDefinition[]): OpenAITool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}
