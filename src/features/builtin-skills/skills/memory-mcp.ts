import type { BuiltinSkill } from "../types"
import { createMemoryMcpConfig } from "../../../shared/memory-mcp-config"

export function createMemoryMcpSkill(): BuiltinSkill {
  return {
    name: "memory-mcp",
    description: "On-demand Hindsight and OpenMemory MCP access without mounting them in every session by default.",
    template: `# Memory MCP (On-Demand)

Load this skill before querying or storing project memory.

## What it mounts

| MCP | Purpose | Typical tool names |
| --- | --- | --- |
| hindsight | temporal/project memory | \`recall\`, \`retain\`, \`list_banks\`, \`create_bank\` |
| openmemory | durable/project knowledge | \`openmemory_query\`, \`openmemory_store\`, \`openmemory_reinforce\` |

## Usage

- Interactive session: \`skill(name="memory-mcp")\`
- Delegated subagent: \`load_skills=["memory-mcp"]\`

Then call the mounted MCPs through \`skill_mcp\`.

### Examples

\`\`\`
skill_mcp(mcp_name="hindsight", tool_name="recall", arguments={"query":"auth regression history","bank_id":"default"})
skill_mcp(mcp_name="openmemory", tool_name="openmemory_query", arguments={"query":"auth regression history","type":"contextual","k":8})
\`\`\`

## Credential loading

- \`OPENMEMORY_API_KEY\` is resolved from \`process.env\`, then project \`.secrets\` / \`.env\`, then \`~/.config/opencode/.secrets\` / \`.env\`, then \`~/.secrets\` / \`.env\`
- If no OpenMemory key is found, the local development fallback \`local-dev-key\` is used
- Hindsight uses the local MCP endpoint and needs no extra credential header

## Guardrails

- Do not assume these MCPs are mounted by default
- Load this skill before any \`skill_mcp(... mcp_name="hindsight"|"openmemory")\` call
- Prefer the memory-retrieval and memory-store subagents for multi-step memory workflows`,
    mcpConfig: createMemoryMcpConfig(),
  }
}
