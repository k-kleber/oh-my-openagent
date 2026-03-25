# Adding Agents, Subagents, and Skills

This is the shortest safe path to add new agents/subagents/skills without breaking integration.

## 1) Add a new builtin agent or subagent

### Implement the agent

- Create agent implementation in `src/agents/<agent-name>.ts` (or `src/agents/<agent-name>/agent.ts` for multi-file agents).
- Follow existing factory pattern (`createXxxAgent`) and set `mode` (`primary`, `subagent`, or `all`).

Reference implementations:

- `src/agents/explore.ts`
- `src/agents/librarian.ts`
- `src/agents/oracle.ts`

### Register the agent

Update these files:

- `src/agents/types.ts`
  - Add the agent name to `BuiltinAgentName`.
- `src/agents/builtin-agents.ts`
  - Register in `agentSources`.
  - Add prompt metadata in `agentMetadata` if it should appear in delegation/prompt sections.
- `src/shared/agent-display-names.ts`
  - Add display-name mapping if needed.

### Add model fallback requirements

Update:

- `src/shared/model-requirements.ts`

If this is missing, the agent can be silently skipped during registration when model resolution fails.

### Make config overrides work

Update:

- `src/config/schema/agent-overrides.ts`

Add your agent key to `AgentOverridesSchema`. If omitted, `agents.<your-agent>` in config will be dropped at parse time.

### Keep invocation resolution compatible

Agent lookup uses normalized config keys. If you add custom naming behavior, verify compatibility with:

- `src/shared/agent-display-names.ts`
- `src/tools/delegate-task/subagent-resolver.ts`

## 2) Add a custom skill (project/user)

Create `SKILL.md` in one of these locations (priority order):

1. `.opencode/skills/<skill-name>/SKILL.md`
2. `~/.config/opencode/skills/<skill-name>/SKILL.md`
3. `.claude/skills/<skill-name>/SKILL.md`
4. `.agents/skills/<skill-name>/SKILL.md`
5. `~/.agents/skills/<skill-name>/SKILL.md`

Minimal format:

```markdown
---
name: my-skill
description: What this skill does
---

# Instructions

Your skill instructions here.
```

Loader path and merge logic:

- `src/features/opencode-skill-loader/skill-discovery.ts`
- `src/features/opencode-skill-loader/merger/skill-definition-merger.ts`

## 3) Add a new builtin skill (in plugin source)

Update:

- Add implementation under `src/features/builtin-skills/skills/<skill-name>.ts`
- Register exports in `src/features/builtin-skills/skills/index.ts`
- Ensure inclusion in `src/features/builtin-skills/skills.ts`
- If disabling is supported via config, include the name in `src/config/schema/agent-names.ts` (`BuiltinSkillNameSchema`)

## 4) Tests you should always run

At minimum:

- Agent resolution / behavior tests (examples):
  - `src/tools/delegate-task/subagent-resolver.test.ts`
  - `src/shared/agent-display-names.test.ts`
- Model and schema tests:
  - `src/shared/model-requirements.test.ts`
  - `src/config/schema.test.ts`

And then run:

```bash
bun test
bun run typecheck
bun run build
```

## 5) Quick integration checklist

- [ ] Agent implemented
- [ ] Agent registered in `types.ts` and `builtin-agents.ts`
- [ ] Model fallback chain added in `model-requirements.ts`
- [ ] Config override key added in `agent-overrides.ts`
- [ ] Invocation/lookup behavior validated (`getAgentConfigKey`, subagent resolver)
- [ ] Skills added in correct directory and discovered by loader
- [ ] Tests + typecheck + build passing

## 6) Brainstormer and deep-planning handoff

The lightweight ideation primary agent is:

- `brainstormer` (display: `Brainstormer (Fast Ideation)`)

### Intent and model profile

- Purpose: fast options and strategy sketches before deep planning.
- Default fallback profile prioritizes lightweight models in `src/shared/model-requirements.ts`.

### Delegation behavior

- Brainstormer can use `call_omo_agent` for limited, optional checks (e.g., one narrow `explore`/`librarian` query when uncertain).
- Keep fanout minimal by prompt policy; do not treat Brainstormer like a deep-research orchestrator.

### File-write guardrails

- Brainstormer is constrained by hook policy to markdown files under `.sisyphus/`.
- Hook: `brainstormer-sisyphus-md-only`

### Start deep planning from brainstorm output

Use builtin command:

- `/start-planning [topic-or-note]`

This command:

1. writes optional intake notes to `.sisyphus/drafts/start-planning-*.md`
2. switches active session agent to Prometheus
3. injects explicit handoff context for deep planning

### Research and writing flow

New integrated primary agents:

- `researcher` (`Researcher (Evidence Scout)`)
- `writer` (`Writer (Content Partner)`)

Recommended default workflow:

1. Use `researcher` for source gathering and evidence packets.
2. Trigger `/start-writing [topic-or-brief]` to hand off to Writer.
3. Writer runs conversational intake (audience, tone, format, constraints) before drafting.

Why this workflow:

- Faster than forcing a dedicated writing-planner every time.
- Better UX for iterative writing, since intake happens naturally in conversation.
- You can still escalate to Metis/Momus for a formal planning layer when the writing project is complex.
