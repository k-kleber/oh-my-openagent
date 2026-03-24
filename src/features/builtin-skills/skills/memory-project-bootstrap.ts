import type { BuiltinSkill } from "../types"

export const memoryProjectBootstrapSkill: BuiltinSkill = {
  name: "memory-project-bootstrap",
  description: "Initialize project memory via orchestrator-controlled phased explore fanout, recursive deep dives, and high-signal storage via memory-store agent.",
  template: `# Memory Project Bootstrap

When starting work in unfamiliar repository: "bootstrap memory for this project", "analyze this codebase".

## Core policy

1. **Orchestrator owns spawning** — Only the orchestrator agent may spawn collector subagents.
2. **Bootstrap-mode gating** — Every spawned collector MUST receive:
   - \`[BOOTSTRAP_MODE] true\`
   - \`[BOOTSTRAP_RUN_ID] <uuid>\`
   - \`[BOOTSTRAP_SCOPE] <scope>\`
   - \`[WORKER_ROLE] overview|deep-dive\`

3. **Two-Phase Intelligence mandatory** — FastCode scout + Serena verification

4. **Memory writes via agent only** — Delegate to \`memory-store\` via \`task()\`

5. **Store high-signal only** — Non-obvious, actionable, certain insights.

## Phased workflow

### Phase 1: Overview fanout (parallel)

Spawn overview collectors with focused scopes:

\`\`\`
task(
  subagent_type="explore",
  load_skills=["memory-bootstrap-collector", "code-intelligence"],
  description="Overview: architecture map",
  prompt="[BOOTSTRAP_MODE] true
[BOOTSTRAP_RUN_ID] <run-id>
[BOOTSTRAP_SCOPE] <scope>
[WORKER_ROLE] overview
[TASK] Build architecture map",
  run_in_background=true
)
\`\`\`

### Phase 2: Synthesize and prioritize

Aggregate overview outputs, produce prioritized deep-dive targets.

### Phase 3: Recursive deep dives

\`\`\`
task(
  subagent_type="explore",
  load_skills=["memory-bootstrap-collector", "code-intelligence"],
  description="Deep dive: <target>",
  prompt="[BOOTSTRAP_MODE] true
[BOOTSTRAP_RUN_ID] <run-id>
[BOOTSTRAP_SCOPE] <scope>
[WORKER_ROLE] deep-dive
[TASK] Deeply analyze <target>",
  run_in_background=true
)
\`\`\`

### Phase 4: Filter candidates

Keep only if ALL pass:
- Non-obvious
- Actionable
- Verifiable
- Stable

### Phase 5: Delegate storage

\`\`\`
task(
  subagent_type="memory-store",
  load_skills=["memory-mcp"],
  description="Store bootstrap insights",
  prompt="Project: <path> (<name>)
Observations:
- [architecture-decision] <insight>",
  run_in_background=false
)
\`\`\`

## Adaptive fanout

| Project size | Overview workers | Deep-dive workers |
|------------|----------------|-----------------|
| Small (<200 files) | 1-2 | 1-2 |
| Medium (200-1500) | 3-5 | 3-6 |
| Large (>1500) | 6-10 | 6-12 |`,
}
