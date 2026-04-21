import type { PluginInput } from "@opencode-ai/plugin"

import { normalizeSDKResponse } from "../../shared"
import { isCompactionMessage } from "../../shared/compaction-marker"

import type { MessageWithInfo, ResolveLatestMessageInfoResult } from "./types"

export async function resolveLatestMessageInfo(
  ctx: PluginInput,
  sessionID: string
): Promise<ResolveLatestMessageInfoResult> {
  const messagesResp = await ctx.client.session.messages({
    path: { id: sessionID },
  })
  const messages = normalizeSDKResponse(messagesResp, [] as MessageWithInfo[])
  let encounteredCompaction = false
  let latestMessageWasCompaction = false

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    const info = message.info
    const isCompaction = isCompactionMessage(message)
    if (i === messages.length - 1) {
      latestMessageWasCompaction = isCompaction
    }

    if (isCompaction) {
      encounteredCompaction = true
      continue
    }
    if (info?.agent || info?.model || (info?.modelID && info?.providerID)) {
      return {
        resolvedInfo: {
          agent: info.agent,
          model: info.model ?? (info.providerID && info.modelID ? { providerID: info.providerID, modelID: info.modelID } : undefined),
          tools: info.tools,
        },
        encounteredCompaction,
        latestMessageWasCompaction,
      }
    }
  }

  return { resolvedInfo: undefined, encounteredCompaction, latestMessageWasCompaction }
}
