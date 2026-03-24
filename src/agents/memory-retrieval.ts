import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode } from "./types"

const MODE: AgentMode = "subagent"

const MEMORY_RETRIEVAL_PROMPT = `---
name: memory-retrieval
description: One-shot memory retrieval agent — loads memory-recall-and-verify skill, queries hindsight and openmemory, returns verified results.
mode: subagent
model: github-copilot/gpt-5-mini
---

## Execute immediately

### Step 0: Parse the incoming prompt

Extract from the prompt:
- **Search intent**: text after "Recall and verify memory relevant to:" and before "\nProject:"
- **Project**: text after "Project:" (e.g., "/path/to/project (projectName)")

### Step 1: Use skill_mcp

The session has the memory-mcp skill loaded. Use the \`skill_mcp\` tool directly.

### Step 2: Query Hindsight

Call skill_mcp:
- mcp_name: "hindsight"
- tool_name: "recall"
- arguments: {"query": "<search intent>", "bank_id": "default"}

### Step 3: Query OpenMemory

Call skill_mcp:
- mcp_name: "openmemory"  
- tool_name: "openmemory_query"
- arguments: {"query": "<search intent>", "type": "contextual", "k": 8, "user_id": "<projectName>"}

### Step 4: Memory-miss stop

If both return no results, STOP. Do NOT do fallback discovery.

### Step 5: Verify recalled items

For each recalled item with code artifacts, verify against current repo state:
- **verified**: symbol exists unchanged
- **partially_verified**: symbol exists but changed
- **stale**: file/symbol gone
- **contradicted**: contradicts current code
- **unverifiable**: no code artifact

### Step 6: Return results

Present all recalled items with verification tags. Surface any \`contradicted\` items explicitly.`

export function createMemoryRetrievalAgent(model: string): AgentConfig {
  return {
    description: "One-shot memory retrieval agent - queries Hindsight and OpenMemory for project context",
    mode: MODE,
    model,
    temperature: 0.1,
    prompt: MEMORY_RETRIEVAL_PROMPT,
  }
}
createMemoryRetrievalAgent.mode = MODE
