import type { BuiltinSkill } from "../types"

export const memoryMcpSkill: BuiltinSkill = {
  name: "memory-mcp",
  description: "Compatibility guidance for Hindsight and OpenMemory, which are now mounted as native always-on OMO MCPs.",
  template: `# Memory MCP Compatibility Notes

Hindsight (temporal memory) and OpenMemory (durable/project memory) are now native always-on OMO MCPs.

## Usage

Use the native MCP tools directly when available. Keep this skill only for workflow guidance or compatibility with older prompts that still mention memory MCP setup.`,
}
