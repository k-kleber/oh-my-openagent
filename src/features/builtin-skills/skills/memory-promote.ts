import type { BuiltinSkill } from "../types"

export const memoryPromoteSkill: BuiltinSkill = {
  name: "memory-promote",
  description: "Reinforce, re-approve, or patch existing OpenMemory records. Use to boost strong memories, correct stale entries, or re-store after conflict resolution.",
  template: `# Memory Promote

User explicitly reinforces a memory: "boost this", "this is important", "fix this entry", or approves promotion from project scope to broader scope.

## Workflow

Load memory MCP access first:

\`\`\`
skill(name="memory-mcp")
\`\`\`

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
skill_mcp(mcp_name="openmemory", tool_name="openmemory_store", arguments={... , "metadata": {"approvalState": "approved"}})
\`\`\`

**If promoting scope:**
\`\`\`
skill_mcp(mcp_name="openmemory", tool_name="openmemory_store", arguments={... , "metadata": {"approvalState": "approved", "scope": "<new scope>", "promotedFrom": "project"}})
\`\`\`

### 4. Confirm

\`\`\`
Reinforced memory <id> in OpenMemory.
\` or \`Corrected version stored (replaced stale entry).
\`\`\`

## Guardrails

- NO auto-patch — explicit human instruction required.
- NO auto-promotion to broader scopes without repeated evidence or explicit approval.
- Only \`verified\` or \`partially_verified\` records can be reinforced.
- Do NOT write into Hindsight — Hindsight is temporal only.`,
}
