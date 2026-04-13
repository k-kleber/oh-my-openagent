import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoryConfig } from "../../config/schema"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared"
import { createWriterAgent } from "../writer"
import { applyOverrides } from "./agent-overrides"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"
import { maybeBuildCavemanSection } from "../dynamic-agent-prompt-builder"

export function maybeCreateWriterConfig(input: {
  disabledAgents: string[]
  agentOverrides: AgentOverrides
  availableModels: Set<string>
  systemDefaultModel?: string
  isFirstRunNoCache: boolean
  mergedCategories: Record<string, CategoryConfig>
  directory?: string
  cavemanEnabled?: boolean
}): AgentConfig | undefined {
  const {
    disabledAgents,
    agentOverrides,
    availableModels,
    systemDefaultModel,
    isFirstRunNoCache,
    mergedCategories,
    directory,
    cavemanEnabled = false,
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

  const cavemanSection = maybeBuildCavemanSection("writer", cavemanEnabled)
  if (cavemanSection) {
    writerConfig.prompt = (writerConfig.prompt || "") + "\n\n" + cavemanSection
  }

  return writerConfig
}
