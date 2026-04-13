import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoryConfig } from "../../config/schema"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared"
import { createDebuggerAgent } from "../debugger"
import { applyOverrides } from "./agent-overrides"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"
import { maybeBuildCavemanSection } from "../dynamic-agent-prompt-builder"

export function maybeCreateDebuggerConfig(input: {
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

  if (disabledAgents.includes("debugger")) return undefined

  const debuggerOverride = agentOverrides["debugger"]
  const debuggerRequirement = AGENT_MODEL_REQUIREMENTS["debugger"]

  let debuggerResolution = applyModelResolution({
    userModel: debuggerOverride?.model,
    requirement: debuggerRequirement,
    availableModels,
    systemDefaultModel,
  })

  if (isFirstRunNoCache && !debuggerOverride?.model) {
    debuggerResolution = getFirstFallbackModel(debuggerRequirement)
  }

  if (!debuggerResolution) return undefined
  const { model: debuggerModel, variant: debuggerResolvedVariant } = debuggerResolution

  let debuggerConfig = createDebuggerAgent(debuggerModel, directory)

  if (debuggerResolvedVariant) {
    debuggerConfig = { ...debuggerConfig, variant: debuggerResolvedVariant }
  }

  debuggerConfig = applyOverrides(
    debuggerConfig,
    debuggerOverride,
    mergedCategories,
    directory,
  )

  const cavemanSection = maybeBuildCavemanSection("debugger", cavemanEnabled)
  if (cavemanSection) {
    debuggerConfig.prompt = (debuggerConfig.prompt || "") + "\n\n" + cavemanSection
  }

  return debuggerConfig
}
