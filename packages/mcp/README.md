# @kitsra/kavio-mcp

Model Context Protocol server and provider tool adapters for Kavio.

## Install

```bash
corepack pnpm add @kitsra/kavio-mcp
```

## Usage

Run the MCP server over stdio:

```bash
kavio-mcp
```

Example MCP host configuration:

```json
{
  "mcpServers": {
    "kavio": {
      "command": "kavio-mcp"
    }
  }
}
```

The package exposes tools for composition validation, inspection, migration,
prop resolution, export preset listing, render planning, and rendering.
`plan_render` reports whether each resolved job should use `ffmpeg-direct` or
`browser-overlay`, explains the decision, and returns arguments for that path.
It also ships provider adapter schemas for Anthropic, OpenAI, and Gemini.

## Links

- Repository: https://github.com/kitsra/kavio
- MCP docs: https://github.com/kitsra/kavio/blob/main/docs/mcp.md
- Package overview: https://github.com/kitsra/kavio/blob/main/docs/packages.md
- License: Elastic-2.0
