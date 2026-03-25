import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoryConfig } from "../../config/schema"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared"
import { createResearcherAgent } from "../researcher"
import { applyOverrides } from "./agent-overrides"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"

export function maybeCreateResearcherConfig(input: {
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

  if (disabledAgents.includes("researcher")) return undefined

  const researcherOverride = agentOverrides["researcher"]
  const researcherRequirement = AGENT_MODEL_REQUIREMENTS["researcher"]

  let researcherResolution = applyModelResolution({
    userModel: researcherOverride?.model,
    requirement: researcherRequirement,
    availableModels,
    systemDefaultModel,
  })

  if (isFirstRunNoCache && !researcherOverride?.model) {
    researcherResolution = getFirstFallbackModel(researcherRequirement)
  }

  if (!researcherResolution) return undefined
  const { model: researcherModel, variant: researcherResolvedVariant } = researcherResolution

  let researcherConfig = createResearcherAgent(researcherModel)

  if (researcherResolvedVariant) {
    researcherConfig = { ...researcherConfig, variant: researcherResolvedVariant }
  }

  researcherConfig = applyOverrides(
    researcherConfig,
    researcherOverride,
    mergedCategories,
    directory,
  )

  return researcherConfig
}
