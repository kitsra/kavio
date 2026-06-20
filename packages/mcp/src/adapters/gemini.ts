import type { JsonSchema, ToolDefinition } from "../types.js";
import { stripForGemini } from "./sanitize.js";

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface GeminiTool {
  functionDeclarations: GeminiFunctionDeclaration[];
}

/** Convert the catalog tools to Gemini function declarations (schema sanitized). */
export function toGeminiTools(tools: readonly ToolDefinition[]): GeminiTool[] {
  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: stripForGemini(tool.inputSchema)
      }))
    }
  ];
}
