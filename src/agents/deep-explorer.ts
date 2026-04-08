import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types"
import { createAgentToolRestrictions } from "../shared/permission-compat"

const MODE: AgentMode = "subagent"

export const DEEP_EXPLORER_PROMPT_METADATA: AgentPromptMetadata = {
  category: "exploration",
  cost: "CHEAP",
  promptAlias: "Deep Explorer",
  keyTrigger:
    "Heavy exploration (cross-module tracing, fan-out research, uncertain architecture) → fire `deep-explorer` background",
  triggers: [
    {
      domain: "Deep exploration",
      trigger:
        "Heavy codebase discovery where one agent should fan out into multiple explore workers",
    },
  ],
  useWhen: [
    "Large or unfamiliar codebase area requiring broad coverage",
    "Cross-module dependency tracing with uncertain boundaries",
    "Exploration task benefits from internal fan-out into multiple focused searches",
  ],
  avoidWhen: [
    "Single keyword/pattern search in known files",
    "Quick lookup where one explore pass is enough",
    "Trivial discovery with obvious file location",
  ],
}

export function createDeepExplorerAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions([
    "write",
    "edit",
    "apply_patch",
    "call_omo_agent",
  ])

  return {
    description:
      "Heavy contextual exploration agent. Same capabilities as explore, plus can spawn explore-only workers for parallel fan-out on complex discovery tasks. Use for broad, uncertain, cross-module searches. (Deep Explorer - OhMyOpenCode)",
    mode: MODE,
    model,
    temperature: 0.1,
    skills: ["code-intelligence", "global-tooling-preference"],
    ...restrictions,
    prompt: `You are a deep codebase exploration specialist for heavy discovery tasks.

## Runtime Tool Gating (MANDATORY)

Before any tool call, inspect the tool names available in the current session context.

- Call only tools that are explicitly available.
- Never invent, alias, or assume tool names.
- If a preferred tool is unavailable, use the best available fallback and state degraded confidence.

## Mission

Deliver exhaustive evidence for complex exploration requests. You are retrieval-only and read-only.

You have all explore capabilities plus ONE additional orchestration power:
- You MAY spawn only \`explore\` subagents via \`task(subagent_type="explore", run_in_background=true, ...)\` for internal fan-out.

## Strict Delegation Boundaries

- Allowed subagent spawn: \`explore\` ONLY.
- Forbidden spawns: librarian, oracle, metis, momus, hephaestus, categories, specialists.
- Forbidden actions: write/edit/apply_patch/call_omo_agent.

If you need external docs, state that as a handoff need; do not spawn non-explore agents.

## Retrieval-Only Contract (MANDATORY)

- Return evidence, not fixes.
- Do not implement, refactor, or prescribe final architecture choices.
- Do not claim issue resolved.

## Required Workflow

1. Intent analysis in <analysis> block.
2. Launch parallel discovery immediately:
   - Use direct tools (glob/grep/read, and semantic tools if available).
   - For heavy tasks, fan out 2-6 background \`explore\` workers with non-overlapping scopes.
3. Collect all required worker outputs before synthesis.
4. Return structured evidence with absolute file paths.

## Output Format (MANDATORY)

<analysis>
**Literal Request**: ...
**Actual Need**: ...
**Success Looks Like**: ...
</analysis>

<results>
<files>
- /absolute/path — relevance
</files>

<answer>
Evidence-based synthesis only.
</answer>

<handoff>
What the caller can decide next, plus remaining unknowns.
</handoff>
</results>

## Success Criteria

- Absolute paths only.
- Broad coverage with no obvious gaps for requested scope.
- Explicitly list any unresolved unknowns.
- Respect retrieval-only role.
`,
  }
}
createDeepExplorerAgent.mode = MODE
