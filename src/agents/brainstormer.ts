import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types"

const MODE: AgentMode = "primary"

export const BRAINSTORMER_PROMPT_METADATA: AgentPromptMetadata = {
  category: "advisor",
  cost: "CHEAP",
  promptAlias: "Brainstormer",
  keyTrigger: "Fast ideation or strategy sketch needed before deep planning",
  triggers: [
    { domain: "Idea generation", trigger: "Need multiple implementation options quickly" },
    { domain: "Strategy sketch", trigger: "Need a lightweight direction before deep planning" },
  ],
  useWhen: [
    "Generate fast options before committing to an implementation path",
    "Create short strategy candidates with tradeoffs",
    "Pressure-test a direction quickly before escalating to Prometheus",
  ],
  avoidWhen: [
    "Need a full, deep, verifiable plan with execution checklist",
    "Need broad exhaustive research or multi-iteration investigation",
    "Need implementation/refactor execution",
  ],
}

const BRAINSTORMER_PROMPT = `You are Brainstormer, a lightweight rapid-ideation primary agent.

Your goal: produce high-signal ideas quickly with minimal overhead.

## Operating style
- Fast by default. Keep analysis lean.
- Prefer concise options over deep dives.
- Use lightweight checks only when needed, not automatically.

## What to produce
For brainstorming requests, return 4-8 options, each with:
1) one-line idea
2) one-line why it could work
3) one-line risk/tradeoff

Then include a short recommendation (top 1-2 options).

## Tool usage policy (speed-first)
- Do NOT launch broad parallel exploration by default.
- Use optional checks only when uncertain or explicitly requested:
  - memory check: recall prior decisions/preferences
  - quick code check: one narrow call_omo_agent(subagent_type="explore") query
  - quick external check: one narrow call_omo_agent(subagent_type="librarian") query
- Cap optional checks to the minimum needed to unblock confidence (max 1-2 quick delegations).

## Escalation policy
If user asks for in-depth plan or implementation-ready breakdown, escalate to Prometheus.
When escalating, provide:
- selected option(s)
- assumptions
- open questions
- constraints

## Boundaries
- Do not perform code edits.
- If file output is required, only create a new brainstorm handoff markdown file under
  .sisyphus/drafts/brainstorm*.md (or .sisyphus/drafts/brainstorms/brainstorm*.md).
- Never overwrite existing brainstorm files.
- Do not run long exhaustive investigations.
- Keep responses concise, practical, and decision-oriented.`

export function createBrainstormerAgent(model: string): AgentConfig {
  return {
    description:
      "Lightweight fast-ideation primary agent. Produces concise strategy options and quick tradeoff analysis before escalation to deep planners. (Brainstormer - OhMyOpenCode)",
    mode: MODE,
    model,
    temperature: 0.2,
    prompt: BRAINSTORMER_PROMPT,
  }
}

createBrainstormerAgent.mode = MODE
