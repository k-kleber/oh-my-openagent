import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoryConfig } from "../../config/schema"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared"
import { createBrainstormerAgent } from "../brainstormer"
import { applyOverrides } from "./agent-overrides"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"

export function maybeCreateBrainstormerConfig(input: {
  disabledAgents: string[]
  agentOverrides: AgentOverrides
  availableModels: Set<string>
  systemDefaultModel?: string
  isFirstRunNoCache: boolean
  mergedCategories: Record<string, CategoryConfig>
  directory?: string
}): AgentConfig | undefined {
  const {
    disabledAgents,
    agentOverrides,
    availableModels,
    systemDefaultModel,
    isFirstRunNoCache,
    mergedCategories,
    directory,
  } = input

  if (disabledAgents.includes("brainstormer")) return undefined

  const brainstormerOverride = agentOverrides["brainstormer"]
  const brainstormerRequirement = AGENT_MODEL_REQUIREMENTS["brainstormer"]

  let brainstormerResolution = applyModelResolution({
    userModel: brainstormerOverride?.model,
    requirement: brainstormerRequirement,
    availableModels,
    systemDefaultModel,
  })

  if (isFirstRunNoCache && !brainstormerOverride?.model) {
    brainstormerResolution = getFirstFallbackModel(brainstormerRequirement)
  }

  if (!brainstormerResolution) return undefined
  const { model: brainstormerModel, variant: brainstormerResolvedVariant } = brainstormerResolution

  let brainstormerConfig = createBrainstormerAgent(brainstormerModel, directory)

  if (brainstormerResolvedVariant) {
    brainstormerConfig = { ...brainstormerConfig, variant: brainstormerResolvedVariant }
  }

  brainstormerConfig = applyOverrides(
    brainstormerConfig,
    brainstormerOverride,
    mergedCategories,
    directory,
  )


  return brainstormerConfig
}
