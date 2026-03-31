import type { BuiltinSkill } from "../types"

export const memoryRecallAndVerifySkill: BuiltinSkill = {
  name: "memory-recall-and-verify",
  description: "Atomic recall-and-verify: pulls from Hindsight and OpenMemory, cross-checks with Serena, returns tagged results.",
  template: `# Memory Recall and Verify

"What do we know about X", "recall architecture decisions about Y", "what patterns have we established for Z".

## Delegation via subagent (preferred)

Spawn the \`memory-retrieval\` subagent via \`task()\`:
\`\`\`
task(
  subagent_type="memory-retrieval",
  load_skills=["memory-recall-and-verify"],
  description="Recall and verify memory",
  prompt="Recall and verify memory relevant to: <query>\\nScope: <project|system|framework|global|user>",
  run_in_background=false
)
\`\`\`

## Inline workflow

### 1. Query Hindsight

\`\`\`
skill_mcp(mcp_name="hindsight", tool_name="recall", arguments={
  "query": "<query>",
  "bank_id": "default"
})
\`\`\`

### 2. Query OpenMemory

\`\`\`
skill_mcp(mcp_name="openmemory", tool_name="openmemory_query", arguments={
  "query": "<query>",
  "type": "contextual",
  "k": 8
})
\`\`\`

### 3. Cross-check with Serena

For each recalled item:
- Symbol exists → \`verified\`
- Symbol exists but changed → \`partially_verified\`
- File/symbol gone → \`stale\`
- Contradicts current code → \`contradicted\`
- Cannot verify → \`unverifiable\`

### 4. Return tagged results

Present all recalled items with verification tags. Surface any \`contradicted\` items explicitly.

## Guardrails

- Raw recalled memory MUST have a verification status tag.
- Low-risk stale items degrade silently; high-impact contradictions shown to user.
- Do NOT split recall and verify into separate steps — this workflow is atomic.`,
  mcpConfig: {
    hindsight: { type: "http", url: "http://localhost:8888/mcp" },
    openmemory: { type: "http", url: "http://localhost:8080/mcp", headers: { "x-api-key": "local-dev-key" } },
  },
}
