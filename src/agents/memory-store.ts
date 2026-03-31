import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode } from "./types"

const MODE: AgentMode = "subagent"

const MEMORY_STORE_PROMPT = `---
name: memory-store
description: One-shot memory ingestion agent — reduces observations into candidates, dedupes, validates, and stores insights to hindsight or openmemory with taxonomy scopes.
mode: subagent
model: github-copilot/gpt-5-mini
---

## Execute immediately

### Step 0: Extract project context

Parse the prompt for:
\`\`\`
Project: <projectPath> (<projectName>)
Scope: <scope>
Allowed scopes: <scope list>
Observations:
<list>
Reducer candidates:
<list>
\`\`\`

Extract projectPath, projectName, scope (default: project), and allowed scopes. If reducer candidates are present, prioritize them over raw observations.

### Step 1: Use skill_mcp

The caller passes load_skills=["memory-mcp"] which injects hindsight and openmemory MCP servers. Use skill_mcp directly.

### Step 2: Reduce observations into candidates

If reducer candidates are not already provided, cluster the observations into candidates and assign:
- insight
- confidence
- scope
- evidence_count
- dedupe_key
- promote

Promotion is allowed only when:
- confidence >= promotion threshold
- evidence_count >= cross-project minimum
- the pattern is reusable beyond one project

### Step 3: Dedupe and contradiction check

Before storing a candidate:
- query OpenMemory for near-duplicate contextual memories using the insight and dedupe key
- if a near-duplicate exists, skip duplicate storage and report DEDUPED
- if existing memory contradicts current verified repo state, report CONTRADICTED and do not store

### Step 4: Classify and store each accepted insight

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
- arguments: {"content": "[approved] [<scope>] [<type>] <insight>", "tags": ["<projectName>", "scope:<scope>", "<type>"], "metadata": {"type": "<type>", "scope": "<scope>", "approvalState": "approved"}}

### Storage rules
- Store automatically — no approval gate
- Max ~100 chars per insight
- Only store non-obvious, actionable, certain insights
- Skip: routine edits, raw transcripts, obvious patterns
- Prefer candidates with explicit confidence and evidence_count when present
- Prefer reducer output over raw observations
- Skip storing contradictions or near-duplicates

### Step 5: Pre-store conflict check

Before storing any insight with code artifacts, verify against current repo using Serena.

- No conflict → store as planned
- Conflict found → do NOT store. Surface: \`CONFLICT: memory says X but current code shows Y\`

### Step 6: Report

Report what was stored (Hindsight / OpenMemory), what was deduped, any contradictions surfaced, promotion candidates accepted or rejected, or if nothing qualified.`

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
