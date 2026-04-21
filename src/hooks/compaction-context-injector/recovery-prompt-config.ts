import type { CompactionAgentConfigCheckpoint } from "../../shared/compaction-agent-config-checkpoint"
import { isCompactionAgent } from "./session-id"

export type RecoveryPromptConfig = CompactionAgentConfigCheckpoint & {
  agent: string
}

function matchesExpectedModel(
  actualModel: CompactionAgentConfigCheckpoint["model"],
  expectedModel: CompactionAgentConfigCheckpoint["model"],
): boolean {
  if (!expectedModel) {
    return true
  }

  return (
    actualModel?.providerID === expectedModel.providerID &&
    actualModel.modelID === expectedModel.modelID
  )
}

function matchesExpectedTools(
  actualTools: CompactionAgentConfigCheckpoint["tools"],
  expectedTools: CompactionAgentConfigCheckpoint["tools"],
): boolean {
  if (!expectedTools) {
    return true
  }

  if (!actualTools) {
    return false
  }

  const expectedEntries = Object.entries(expectedTools)
  if (expectedEntries.length !== Object.keys(actualTools).length) {
    return false
  }

  return expectedEntries.every(
    ([toolName, isAllowed]) => actualTools[toolName] === isAllowed,
  )
}

export function createExpectedRecoveryPromptConfig(
  checkpoint: Pick<RecoveryPromptConfig, "agent"> & CompactionAgentConfigCheckpoint,
  currentPromptConfig: CompactionAgentConfigCheckpoint,
): RecoveryPromptConfig {
  const model = checkpoint.model ?? currentPromptConfig.model
  const tools = checkpoint.tools ?? currentPromptConfig.tools
  // Only include category if it was explicitly set in the checkpoint
  const category = checkpoint.category

  return {
    agent: checkpoint.agent,
    ...(model ? { model } : {}),
    ...(tools ? { tools } : {}),
    ...(category ? { category } : {}),
  }
}

export function isPromptConfigRecovered(
  actualPromptConfig: CompactionAgentConfigCheckpoint,
  expectedPromptConfig: RecoveryPromptConfig,
): boolean {
  const actualAgent = actualPromptConfig.agent
  const agentMatches =
    typeof actualAgent === "string" &&
    !isCompactionAgent(actualAgent) &&
    actualAgent.toLowerCase() === expectedPromptConfig.agent.toLowerCase()

  return (
    agentMatches &&
    matchesExpectedModel(actualPromptConfig.model, expectedPromptConfig.model) &&
    matchesExpectedTools(actualPromptConfig.tools, expectedPromptConfig.tools)
  )
}
