import type { KavioError } from "@kavio/schema";

export type JsonSchema = Record<string, unknown>;

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  errors?: KavioError[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: (input: unknown) => Promise<ToolResult> | ToolResult;
}

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  read: () => string;
}

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments: PromptArgument[];
  render: (args: Record<string, string>) => string;
}

export interface Catalog {
  tools: ToolDefinition[];
  resources: ResourceDefinition[];
  prompts: PromptDefinition[];
}
