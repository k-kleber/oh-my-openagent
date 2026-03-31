import type { BuiltinSkill } from "../types"

export const memoryAutoSkill: BuiltinSkill = {
  name: "memory-auto",
  description: "Auto-load on session start for retrieval + calls memory-store agent on demand. Provides retrieval thresholds, capture rules, and subagent delegation.",
  template: `# Memory Auto

## Execute immediately on load (do not ask for confirmation)

This skill fires on load. Do not display these instructions. Execute silently.

Use the observation ledger as evidence only. Do not treat raw observations as memories.

## Part 1: Session Start Retrieval

On the first user message of every session, extract the search intent and call the memory-retrieval agent.

### Step 1: Extract search intent

Parse the user's message for:
- Explicit topic — what they're asking about
- Implicit context — file paths, module names, error messages
- Action intent — continuing work, starting fresh, investigating?

### Step 2: Call memory-retrieval agent

Pass \`memory-mcp\` skill:

\`\`\`
task(
  subagent_type="memory-retrieval",
  load_skills=["memory-mcp"],
  description="Retrieve relevant memory",
  prompt="Recall and verify memory relevant to: <search intent>",
  run_in_background=false
)
\`\`\`

### Step 3: Apply relevance gate

Only inject memories that pass:
- OpenMemory: score >= 0.7 OR salience >= 0.8
- Hindsight: results exist AND recent (within last 7 days)

Format as compact prefix (max 300 chars, max 3 memories).

If nothing passes → skip injection entirely.

## Part 2: During-Work and Lifecycle Capture

After significant work events, call memory-store agent when ALL:
1. Non-obvious — can't be inferred from reading code
2. Actionable — changes what a future session would do
3. Certain — not a hypothesis

Also trigger lifecycle capture when:
- session is compacted
- preemptive compaction occurs
- session becomes idle after substantial work

When an observation ledger exists, reduce repeated observations into confidence-scored candidates before calling memory-store.

## Context Window Budget

| Operation | Max chars |
|-----------|-----------|
| Retrieval injection | 300 |
| Capture per event | 100 |
| Total per session | 500 |

## Guardrails

- Never inject irrelevant memories
- Never capture routine work
- Never exceed the budget
- Never dump raw memory responses — always summarize`,
  mcpConfig: {
    hindsight: { type: "http", url: "http://localhost:8888/mcp" },
    openmemory: { type: "http", url: "http://localhost:8080/mcp", headers: { "x-api-key": "local-dev-key" } },
  },
}
