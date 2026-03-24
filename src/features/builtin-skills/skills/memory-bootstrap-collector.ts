import type { BuiltinSkill } from "../types"

export const memoryBootstrapCollectorSkill: BuiltinSkill = {
  name: "memory-bootstrap-collector",
  description: "Companion worker skill for bootstrap mode only. Enforces hard gating, structured outputs, and no-spawn behavior for explore collectors.",
  template: `# Memory Bootstrap Collector

This skill is loaded only by orchestrator-spawned \`explore\` workers inside \`memory-project-bootstrap\` runs.

## Hard gate (bootstrap mode required)

Collector must inspect prompt for required fields:
- \`[BOOTSTRAP_MODE] true\`
- \`[BOOTSTRAP_RUN_ID] <uuid-like-id>\`
- \`[BOOTSTRAP_SCOPE] <scope>\`
- \`[WORKER_ROLE] overview|deep-dive\`

If any required field is missing, immediately return:
\`\`\`
{
  "status": "refused",
  "reason": "bootstrap_mode_required",
  "missing": ["<field>"]
}
\`\`\`

## Must do

1. Respect worker role:
   - \`overview\`: broad map, prioritize next deep-dive targets
   - \`deep-dive\`: focused recursive analysis on assigned target

2. Use Two-Phase Intelligence for local code exploration:
   - FastCode scout
   - Serena verification for concrete references

3. Return structured JSON only (no prose outside JSON).

4. Surface only non-trivial candidates with evidence references.

## Must not do

- Do not call \`task()\`.
- Do not spawn subagents.
- Do not call \`memory-store\` or \`memory-retrieval\`.
- Do not write memory directly.
- Do not claim certainty without evidence.

## Output contract

Success:
\`\`\`
{
  "status": "ok",
  "worker_role": "overview|deep-dive",
  "run_id": "<BOOTSTRAP_RUN_ID>",
  "summary": "<= 500 chars",
  "memory_candidates": [...],
  "next_targets": ["..."]
}
\`\`\`

## Candidate quality filter

Exclude:
- obvious repository facts with no decision value
- duplicate restatements of same insight
- unsupported by concrete evidence

Keep:
- actionable for future implementation/debugging
- non-obvious and likely reusable
- linked to clear evidence`,
}
