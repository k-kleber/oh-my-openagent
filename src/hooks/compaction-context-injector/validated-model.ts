import type { CompactionAgentConfigCheckpoint } from "../../shared/compaction-agent-config-checkpoint"
import { isCompactionAgent } from "./session-id"

type PromptConfigInfo = {
  agent?: string
  model?: {
    providerID?: string
    modelID?: string
  }
  providerID?: string
  modelID?: string
}

export function resolveValidatedModel(
  info: PromptConfigInfo | undefined,
): CompactionAgentConfigCheckpoint["model"] | undefined {
  if (isCompactionAgent(info?.agent)) {
    return undefined
  }

  const providerID = info?.model?.providerID ?? info?.providerID
  const modelID = info?.model?.modelID ?? info?.modelID

  if (!providerID || !modelID) {
    return undefined
  }

  return { providerID, modelID }
}

export function validateCheckpointModel(
  checkpointModel: CompactionAgentConfigCheckpoint["model"],
  currentModel: CompactionAgentConfigCheckpoint["model"],
  currentAgent: string | undefined,
): CompactionAgentConfigCheckpoint["model"] | undefined {
  if (!checkpointModel) {
    return undefined
  }

  if (!currentModel) {
    return checkpointModel
  }

  // If the current model differs but the current agent is the compaction agent,
  // trust the checkpoint model — the session was temporarily using a different model
  // during summarization, and we need to restore the original.
  if (isCompactionAgent(currentAgent)) {
    return checkpointModel
  }

  return checkpointModel.providerID === currentModel.providerID &&
    checkpointModel.modelID === currentModel.modelID
    ? checkpointModel
    : undefined
}
