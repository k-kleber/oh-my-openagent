import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoryConfig } from "../../config/schema"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared"
import { createDeepExplorerAgent } from "../deep-explorer"
import { applyOverrides } from "./agent-overrides"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"

export function maybeCreateDeepExplorerConfig(input: {
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

  if (disabledAgents.includes("deep-explorer")) return undefined

  const deepExplorerOverride = agentOverrides["deep-explorer"]
  const deepExplorerRequirement = AGENT_MODEL_REQUIREMENTS["deep-explorer"]

  let deepExplorerResolution = applyModelResolution({
    userModel: deepExplorerOverride?.model,
    requirement: deepExplorerRequirement,
    availableModels,
    systemDefaultModel,
  })

  if (isFirstRunNoCache && !deepExplorerOverride?.model) {
    deepExplorerResolution = getFirstFallbackModel(deepExplorerRequirement)
  }

  if (!deepExplorerResolution) return undefined
  const { model: deepExplorerModel, variant: deepExplorerResolvedVariant } = deepExplorerResolution

  let deepExplorerConfig = createDeepExplorerAgent(deepExplorerModel, directory)

  if (deepExplorerResolvedVariant) {
    deepExplorerConfig = { ...deepExplorerConfig, variant: deepExplorerResolvedVariant }
  }

  deepExplorerConfig = applyOverrides(
    deepExplorerConfig,
    deepExplorerOverride,
    mergedCategories,
    directory,
  )

  return deepExplorerConfig
}
