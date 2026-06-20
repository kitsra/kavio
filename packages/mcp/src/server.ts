import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import type { Catalog } from "./types.js";

/**
 * Wire a Catalog to an MCP server using the SDK's low-level Server +
 * setRequestHandler, so the catalog's raw JSON Schemas flow straight through
 * (the high-level registerTool API is zod-centric and would break the shared
 * source of truth used by the adapters).
 */
export function createServer(catalog: Catalog): Server {
  const server = new Server(
    { name: "kavio", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: catalog.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = catalog.tools.find((candidate) => candidate.name === request.params.name);
    if (tool === undefined) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }
    const result = await tool.handler(request.params.arguments ?? {});
    return {
      content: [{ type: "text", text: JSON.stringify(result.ok ? result.data : result.errors, null, 2) }],
      isError: !result.ok
    };
  });

  server.setRequestHandler(ListResourcesRequestSchema, () => ({
    resources: catalog.resources.map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType
    }))
  }));

  server.setRequestHandler(ReadResourceRequestSchema, (request) => {
    const resource = catalog.resources.find((candidate) => candidate.uri === request.params.uri);
    if (resource === undefined) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${request.params.uri}`);
    }
    return { contents: [{ uri: resource.uri, mimeType: resource.mimeType, text: resource.read() }] };
  });

  server.setRequestHandler(ListPromptsRequestSchema, () => ({
    prompts: catalog.prompts.map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments
    }))
  }));

  server.setRequestHandler(GetPromptRequestSchema, (request) => {
    const prompt = catalog.prompts.find((candidate) => candidate.name === request.params.name);
    if (prompt === undefined) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${request.params.name}`);
    }
    const args = (request.params.arguments ?? {}) as Record<string, string>;
    return { messages: [{ role: "user", content: { type: "text", text: prompt.render(args) } }] };
  });

  return server;
}
