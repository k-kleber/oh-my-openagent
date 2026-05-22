import type { BuiltinSkill } from "../types"

export const memoryCaptureSkill: BuiltinSkill = {
  name: "memory-capture",
  description: "Explicit-only capture: temporal observations go to Hindsight, durable knowledge goes to OpenMemory (approved state).",
  template: `# Memory Capture

When the user explicitly wants to remember something: "remember that X", "capture this decision", "save this pattern for later".

## Classify first

Load memory MCP access first:

\`\`\`
skill(name="memory-mcp")
\`\`\`

| Type     | Destination | Native tool |
| -------- | ----------- | ----------- |
| Temporal | Hindsight   | \`skill_mcp(... mcp_name="hindsight", tool_name="retain")\` |
| Durable  | OpenMemory  | \`skill_mcp(... mcp_name="openmemory", tool_name="openmemory_store")\` |

## Workflow

### 1. Classify the content

Determine the MemoryRecordType. Reject anything that doesn't fit a category.

### 2a. Temporal → Hindsight

Call through \`skill_mcp\`:
\`\`\`
skill_mcp(mcp_name="hindsight", tool_name="retain", arguments={"content": "[<type>] <content>", "context": "<projectPath>", "tags": ["<projectName>", "<type>"], "bank_id": "default"})
\`\`\`

### 2b. Durable → OpenMemory

Call through \`skill_mcp\`:
\`\`\`
skill_mcp(mcp_name="openmemory", tool_name="openmemory_store", arguments={"content": "[approved] [<type>] <content>", "tags": ["<projectName>", "<type>"], "metadata": {"type": "<type>", "scope": "project", "approvalState": "approved"}})
\`\`\`

### 2c. Scope and taxonomy tags (required)

- Include scope tag: \`scope:<scope>\` where scope is one of \`project|system|framework|global|user\`
- Include metadata scope aligned to the selected scope
- If scope is missing, default to \`project\`

## Guardrails

- Reject uncategorized content
- If conflict found with current codebase, pause and ask user: \`CONFLICT: memory says X but current code shows Y — which is truth?\`
- Do NOT write durable memory into Hindsight
- Use \`memory-mcp\` + \`skill_mcp\` for Hindsight and OpenMemory`,
}
