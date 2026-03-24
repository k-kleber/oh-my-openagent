import type { BuiltinSkill } from "../types"

export const memoryPromoteSkill: BuiltinSkill = {
  name: "memory-promote",
  description: "Reinforce, re-approve, or patch existing OpenMemory records. Use to boost strong memories, correct stale entries, or re-store after conflict resolution.",
  template: `# Memory Promote

User explicitly reinforces a memory: "boost this", "this is important", "fix this entry".

## Workflow

### 1. Identify the record

User must reference a specific memory from prior recall result or by content.

### 2. Confirm human intent

User must say "boost", "reinforce", "fix", "patch", "promote" explicitly. Do NOT infer.

### 3. Act

**If reinforcing:**
\`\`\`
skill_mcp(mcp_name="openmemory", tool_name="openmemory_reinforce", arguments={"id": "<id>", "boost": 0.1})
\`\`\`

**If patching/corrected version:**
\`\`\`
skill_mcp(mcp_name="openmemory", tool_name="openmemory_store", arguments={..., "metadata": {"approvalState": "approved"}})
\`\`\`

### 4. Confirm

\`\`\`
Reinforced memory <id> in OpenMemory.
\` or \`Corrected version stored (replaced stale entry).
\`\`\`

## Guardrails

- NO auto-patch — explicit human instruction required.
- Only \`verified\` or \`partially_verified\` records can be reinforced.
- Do NOT write into Hindsight — Hindsight is temporal only.`,
  mcpConfig: {
    openmemory: { type: "http", url: "http://localhost:8080/mcp", headers: { "x-api-key": "local-dev-key" } },
  },
}
