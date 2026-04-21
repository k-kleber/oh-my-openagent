import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoryConfig } from "../../config/schema"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared"
import { createExploreAgent } from "../explore"
import { applyOverrides } from "./agent-overrides"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"

export function maybeCreateExploreConfig(input: {
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

  if (disabledAgents.includes("explore")) return undefined

  const exploreOverride = agentOverrides["explore"]
  const exploreRequirement = AGENT_MODEL_REQUIREMENTS["explore"]

  let exploreResolution = applyModelResolution({
    userModel: exploreOverride?.model,
    requirement: exploreRequirement,
    availableModels,
    systemDefaultModel,
  })

  if (isFirstRunNoCache && !exploreOverride?.model) {
    exploreResolution = getFirstFallbackModel(exploreRequirement)
  }

  if (!exploreResolution) return undefined
  const { model: exploreModel, variant: exploreResolvedVariant } = exploreResolution

  let exploreConfig = createExploreAgent(exploreModel, directory)

  if (exploreResolvedVariant) {
    exploreConfig = { ...exploreConfig, variant: exploreResolvedVariant }
  }

  exploreConfig = applyOverrides(
    exploreConfig,
    exploreOverride,
    mergedCategories,
    directory,
  )

  return exploreConfig
}
