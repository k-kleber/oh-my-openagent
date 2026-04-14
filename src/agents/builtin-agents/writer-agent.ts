import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoryConfig } from "../../config/schema"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared"
import { createWriterAgent } from "../writer"
import { applyOverrides } from "./agent-overrides"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"

export function maybeCreateWriterConfig(input: {
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

  if (disabledAgents.includes("writer")) return undefined

  const writerOverride = agentOverrides["writer"]
  const writerRequirement = AGENT_MODEL_REQUIREMENTS["writer"]

  let writerResolution = applyModelResolution({
    userModel: writerOverride?.model,
    requirement: writerRequirement,
    availableModels,
    systemDefaultModel,
  })

  if (isFirstRunNoCache && !writerOverride?.model) {
    writerResolution = getFirstFallbackModel(writerRequirement)
  }

  if (!writerResolution) return undefined
  const { model: writerModel, variant: writerResolvedVariant } = writerResolution

  let writerConfig = createWriterAgent(writerModel)

  if (writerResolvedVariant) {
    writerConfig = { ...writerConfig, variant: writerResolvedVariant }
  }

  writerConfig = applyOverrides(writerConfig, writerOverride, mergedCategories, directory)


  return writerConfig
}
