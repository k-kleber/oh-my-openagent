import type { BuiltinSkill } from "../types"

export const memoryPreCompactionSkill: BuiltinSkill = {
  name: "memory-pre-compaction",
  description: "Pre-compaction memory-save analysis — synthesizes high-signal insights and delegates storage to the memory-store subagent.",
  template: `# Memory Pre-Compaction

Pre-compaction memory-save analysis before context compaction.

## Automatic Path

When oh-my-openagent triggers preemptive compaction (usage ratio >= threshold), the memory auto-trigger hook performs pre-compaction lifecycle capture and delegates to \`memory-store\` subagent.

## Manual Invocation

Load this skill: \`load_skills=["memory-pre-compaction"]\`

Instruct: "Run pre-compaction memory-save analysis now."

Use when:
- Long session approaching compaction
- About to intentionally compact context
- Just finished high-impact work

## What to capture

Only high-signal:
- architecture decisions and rationale
- root causes and failed approaches
- implementation patterns and user preferences

Do NOT capture:
- raw transcript dumps
- routine edits
- speculative hypotheses
- anything obvious from code

## Workflow

### 1) Synthesize content

Identify non-obvious, actionable, certain observations (max ~100 chars each).

### 2) Spawn memory-store subagent

\`\`\`
task(
  subagent_type="memory-store",
  load_skills=["memory-capture"],
  description="Pre-compaction memory capture",
  prompt="Pre-compaction analysis. Store high-signal insights:",
  run_in_background=false
)
\`\`\`

The subagent will classify, store, cross-check with Serena, and ask on conflicts.

### 3) Safe no-op

If no insights pass threshold: \`No high-signal pre-compaction memory found; skipped capture.\`

## Evidence standard

- trigger used (PreCompact hook or manual)
- items captured (or explicit no-op)
- destination per item`,
  mcpConfig: {
    hindsight: { type: "http", url: "http://localhost:8888/mcp" },
    openmemory: { type: "http", url: "http://localhost:8080/mcp", headers: { "x-api-key": "local-dev-key" } },
  },
}
