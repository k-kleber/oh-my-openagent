import type { BuiltinSkill } from "../types"

export const memoryMcpSkill: BuiltinSkill = {
  name: "memory-mcp",
  description: "MCP configuration only — provides skill_mcp access to Hindsight and OpenMemory servers.",
  template: `# Memory MCP Configuration

This skill provides MCP access to Hindsight (temporal memory) and OpenMemory (durable memory) servers.

## Usage

The MCP servers are available via the \`skill_mcp\` tool:
- mcp_name: "hindsight" - for temporal/contextual memory
- mcp_name: "openmemory" - for durable/project memory`,
  mcpConfig: {
    hindsight: { type: "http", url: "http://localhost:8888/mcp" },
    openmemory: { type: "http", url: "http://localhost:8080/mcp", headers: { "x-api-key": "local-dev-key" } },
  },
}
