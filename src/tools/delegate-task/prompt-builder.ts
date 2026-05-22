import type { BuildSystemContentInput } from "./types"
import { buildPlanAgentSystemPrepend, isPlanAgent } from "./constants"
import { buildSystemContentWithTokenLimit } from "./token-limiter"

const FREE_OR_LOCAL_PROMPT_TOKEN_LIMIT = 24000
const PLAN_AGENT_PROMPT_APPEND = `

Additional requirements for this planning request:
- Answer in English.
- Write the plan in English.
- Plan well for ultrawork execution.
- Use TDD-oriented planning.
- Include a clear atomic commit strategy.`

const DEBUGGER_SUBAGENT_PROMPT_APPEND = `

Additional requirements for this debugger task:
- You are running as a subagent via task(...), so your response MUST be machine-parseable for the caller.
- End with this exact XML structure:
<results>
<diagnosis>
<status>identified|inconclusive|blocked</status>
<summary>[one-sentence failure summary]</summary>
<root_cause>[exact defect or state mismatch, or "unknown"]</root_cause>
<confidence>high|medium|low</confidence>
</diagnosis>

<evidence>
- /absolute/path/to/file:line — [specific evidence]
</evidence>

<handoff>
<implementation_guidance>[minimal next-step guidance for the caller agent]</implementation_guidance>
<open_questions>[remaining unknowns or the word "none"]</open_questions>
</handoff>
</results>
- Keep the XML tags exactly as written above.
- Use absolute file paths in <evidence> entries.
- Do not omit the <results> block even when the diagnosis is inconclusive or blocked.
- Put free-form explanation before the XML only if it helps, but the final block must remain parseable.`

function usesFreeOrLocalModel(model: { providerID: string; modelID: string; variant?: string } | undefined): boolean {
  if (!model) {
    return false
  }

  const provider = model.providerID.toLowerCase()
  const modelId = model.modelID.toLowerCase()
  return provider.includes("local")
    || provider === "ollama"
    || provider === "lmstudio"
    || modelId.includes("free")
}

/**
 * Build the system content to inject into the agent prompt.
 * Combines skill content, category prompt append, and plan agent system prepend.
 */
export function buildSystemContent(input: BuildSystemContentInput): string | undefined {
  const {
    skillContent,
    skillContents,
    categoryPromptAppend,
    agentsContext,
    maxPromptTokens,
    model,
    agentName,
    availableCategories,
    availableSkills,
  } = input

  const planAgentPrepend = isPlanAgent(agentName)
    ? buildPlanAgentSystemPrepend(availableCategories, availableSkills)
    : ""

  const effectiveMaxPromptTokens = maxPromptTokens
    ?? (usesFreeOrLocalModel(model) ? FREE_OR_LOCAL_PROMPT_TOKEN_LIMIT : undefined)

  return buildSystemContentWithTokenLimit(
    {
      skillContent,
      skillContents,
      categoryPromptAppend,
      agentsContext: agentsContext ?? planAgentPrepend,
      planAgentPrepend,
    },
    effectiveMaxPromptTokens
  )
}

export function buildTaskPrompt(prompt: string, agentName: string | undefined): string {
  let result = prompt

  if (isPlanAgent(agentName)) {
    result = `${result}${PLAN_AGENT_PROMPT_APPEND}`
  }

  if (agentName === "debugger") {
    result = `${result}${DEBUGGER_SUBAGENT_PROMPT_APPEND}`
  }

  return result
}
