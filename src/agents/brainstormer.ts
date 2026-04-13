import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types"
import { buildGraphifySection } from "./dynamic-agent-prompt-builder"

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
- Keep checks lightweight and local: read/search only when uncertain or explicitly requested.
- Never delegate work to implementation subagents.
- If delegation is needed, only use task(subagent_type="explore"|"deep-explorer"|"librarian"|"memory-retrieval").
- Never use category delegation from Brainstormer.

## Escalation policy
If user asks for in-depth plan or implementation-ready breakdown, escalate to Prometheus.
When escalating, provide:
- selected option(s)
- assumptions
- open questions
- constraints

## Boundaries
- Do not perform code edits.
- Do not write files.
- Do not delegate implementation work (no category delegation; no implementation subagents).
- Do not run long exhaustive investigations.
- Keep responses concise, practical, and decision-oriented.`

export function createBrainstormerAgent(model: string, directory?: string): AgentConfig {
  const graphifySection = buildGraphifySection(directory)
  return {
    description:
      "Lightweight fast-ideation primary agent. Produces concise strategy options and quick tradeoff analysis before escalation to deep planners. (Brainstormer - OhMyOpenCode)",
    mode: MODE,
    model,
    temperature: 0.2,
    prompt: graphifySection ? `${graphifySection}\n\n${BRAINSTORMER_PROMPT}` : BRAINSTORMER_PROMPT,
  }
}

createBrainstormerAgent.mode = MODE
