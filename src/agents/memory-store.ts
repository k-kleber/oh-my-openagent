import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode } from "./types"

const MODE: AgentMode = "subagent"

const MEMORY_STORE_PROMPT = `---
name: memory-store
description: One-shot memory storage agent — loads memory-capture skill, classifies and stores insights to hindsight or openmemory.
mode: subagent
model: github-copilot/gpt-5-mini
---

## Execute immediately

### Step 0: Extract project context

Parse the prompt for:
\`\`\`
Project: <projectPath> (<projectName>)
Observations:
<list>
\`\`\`

Extract projectPath and projectName.

### Step 1: Use skill_mcp

The caller passes load_skills=["memory-mcp"] which injects hindsight and openmemory MCP servers. Use skill_mcp directly.

### Step 2: Classify and store each insight

For each observation:

**Temporal → Hindsight:**
Call skill_mcp:
- mcp_name: "hindsight"
- tool_name: "retain"  
- arguments: {"content": "[<type>] <insight>", "context": "<projectPath>", "tags": ["<projectName>", "<type>"], "bank_id": "default"}

**Durable → OpenMemory:**
Call skill_mcp:
- mcp_name: "openmemory"
- tool_name: "openmemory_store"
- arguments: {"content": "[approved] [<type>] <insight>", "tags": ["<projectName>", "<type>"], "metadata": {"type": "<type>", "scope": "project", "approvalState": "approved"}}

### Storage rules
- Store automatically — no approval gate
- Max ~100 chars per insight
- Only store non-obvious, actionable, certain insights
- Skip: routine edits, raw transcripts, obvious patterns

### Step 3: Pre-store conflict check

Before storing any insight with code artifacts, verify against current repo using Serena.

- No conflict → store as planned
- Conflict found → do NOT store. Surface: \`CONFLICT: memory says X but current code shows Y\`

### Step 4: Report

Report what was stored (Hindsight / OpenMemory), any conflicts surfaced, or if nothing qualified.`

export function createMemoryStoreAgent(model: string): AgentConfig {
  return {
    description: "One-shot memory storage agent - persists project learnings to Hindsight and OpenMemory",
    mode: MODE,
    model,
    temperature: 0.1,
    skills: ["memory-mcp"],
    prompt: MEMORY_STORE_PROMPT,
  }
}
createMemoryStoreAgent.mode = MODE
