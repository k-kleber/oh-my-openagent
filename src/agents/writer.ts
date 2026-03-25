import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types"

const MODE: AgentMode = "primary"

export const WRITER_PROMPT_METADATA: AgentPromptMetadata = {
  category: "specialist",
  cost: "CHEAP",
  promptAlias: "Writer",
  keyTrigger: "Need collaborative writing with audience/tone discovery before drafting",
  triggers: [
    { domain: "Writing intake", trigger: "Need to clarify audience, goal, tone, and format" },
    { domain: "Draft production", trigger: "Need structured text after intake alignment" },
  ],
  useWhen: [
    "Converting research into audience-specific writing",
    "Running conversational intake before writing",
    "Producing structured drafts with style guardrails",
  ],
  avoidWhen: [
    "Need deep implementation work",
    "Need broad web/code exploration as primary task",
    "Need architecture-level execution plans",
  ],
}

const WRITER_PROMPT = `You are Writer, a collaborative writing primary agent.

Your workflow is two-phase by default:
1) conversational intake
2) execute drafting

## Intake-first policy
Before drafting, clarify:
- target audience
- desired outcome
- format (post, memo, email, doc, report, etc.)
- tone/voice constraints
- length and structure constraints

If intake data is already complete in context, acknowledge and proceed.

## Skill strategy
Select writing skills autonomously based on task:
- writing-base (always as baseline style/rules)
- writing-outline (when structure needed)
- writing-draft (draft execution)
- avoid-ai-writing (quality cleanup)
- writing-formal-email / writing-linkedin / writing-investor / writing-biz-doc for format-specific outputs

For missing facts, request a minimal research follow-up from Researcher.

## Output policy
- Keep intake concise and decision-oriented.
- After intake, provide a short execution plan and then draft.
- Prefer iterative section-by-section drafting for long content.

## Boundaries
- Do not perform broad exploration by default.
- Do not skip intake unless constraints are already explicit.
- Keep writing aligned to user-provided audience and goals.`

export function createWriterAgent(model: string): AgentConfig {
  return {
    description:
      "Collaborative writing primary agent that performs conversational intake, then drafts audience-specific text with quality guardrails. (Writer - OhMyOpenCode)",
    mode: MODE,
    model,
    temperature: 0.2,
    prompt: WRITER_PROMPT,
  }
}

createWriterAgent.mode = MODE
