import type { CallOmoAgentArgs } from "./types"
import type { PluginInput } from "@opencode-ai/plugin"
import { subagentSessions, syncSubagentSessions } from "../../features/claude-code-session-state"
import { clearSessionFallbackChain, setSessionFallbackChain } from "../../hooks/model-fallback/hook"
import { getAgentToolRestrictions, log } from "../../shared"
import type { FallbackEntry } from "../../shared/model-requirements"
import { waitForCompletion } from "./completion-poller"
import { processMessages } from "./message-processor"
import { createOrGetSession } from "./session-creator"
import type { CallOmoAgentModelConfig } from "./types"

type SessionWithPromptAsync = {
  promptAsync: (opts: { path: { id: string }; body: Record<string, unknown> }) => Promise<unknown>
}

type ExecuteSyncDeps = {
  createOrGetSession: typeof createOrGetSession
  waitForCompletion: typeof waitForCompletion
  processMessages: typeof processMessages
  setSessionFallbackChain: typeof setSessionFallbackChain
  clearSessionFallbackChain: typeof clearSessionFallbackChain
}

type SpawnReservation = {
  commit: () => number
  rollback: () => void
}

const defaultDeps: ExecuteSyncDeps = {
  createOrGetSession,
  waitForCompletion,
  processMessages,
  setSessionFallbackChain,
  clearSessionFallbackChain,
}

export async function executeSync(
  args: CallOmoAgentArgs,
  toolContext: {
    sessionID: string
    messageID: string
    agent: string
    abort: AbortSignal
    metadata?: (input: { title?: string; metadata?: Record<string, unknown> }) => void | Promise<void>
  },
  ctx: PluginInput,
  deps: ExecuteSyncDeps = defaultDeps,
  fallbackChain?: FallbackEntry[],
  spawnReservation?: SpawnReservation,
  resolvedModel?: CallOmoAgentModelConfig,
): Promise<string> {
  let sessionID: string | undefined
  let createdSessionForExecution = false
  let appliedFallbackChain = false
  let promptDelivered = false

  try {
    const session = await deps.createOrGetSession(args, toolContext, ctx)
    sessionID = session.sessionID
    createdSessionForExecution = session.isNew
    subagentSessions.add(sessionID)
    syncSubagentSessions.add(sessionID)

    if (fallbackChain && fallbackChain.length > 0) {
      deps.setSessionFallbackChain(sessionID, fallbackChain)
      appliedFallbackChain = true
    }

    log(`[call_omo_agent] Sending prompt to session ${sessionID}`)
    log(`[call_omo_agent] Prompt text:`, args.prompt.substring(0, 100))

    try {
      await (ctx.client.session as unknown as SessionWithPromptAsync).promptAsync({
        path: { id: sessionID },
        body: {
          agent: args.subagent_type,
          ...(resolvedModel ? { model: { providerID: resolvedModel.providerID, modelID: resolvedModel.modelID } } : {}),
          ...(resolvedModel?.variant ? { variant: resolvedModel.variant } : {}),
          tools: {
            ...getAgentToolRestrictions(args.subagent_type),
            task: false,
            question: false,
          },
          parts: [{ type: "text", text: args.prompt }],
        },
      })
      promptDelivered = true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      log(`[call_omo_agent] Prompt error:`, errorMessage)
      if (errorMessage.includes("agent.name") || errorMessage.includes("undefined")) {
        return `Error: Agent "${args.subagent_type}" not found. Make sure the agent is registered in your opencode.json or provided by a plugin.`
      }
      return `Error: Failed to send prompt: ${errorMessage}`
    }

    if (session.isNew) {
      spawnReservation?.commit()
    }

    await Promise.resolve(
      toolContext.metadata?.({
        title: args.description,
        metadata: {
          sessionId: sessionID,
          ...(resolvedModel ? { model: resolvedModel } : {}),
        },
      })
    )

    await deps.waitForCompletion(sessionID, toolContext, ctx)

    const responseText = await deps.processMessages(sessionID, ctx)

    return responseText + "\n\n" + ["<task_metadata>", `session_id: ${sessionID}`, "</task_metadata>"].join("\n")
  } catch (error) {
    spawnReservation?.rollback()
    throw error
  } finally {
    if (sessionID && appliedFallbackChain) {
      deps.clearSessionFallbackChain(sessionID)
    }

    if (sessionID && createdSessionForExecution && !promptDelivered) {
      try {
        await ctx.client.session.abort({ path: { id: sessionID } } as { path: { id: string } })
      } catch {}
    }

    if (sessionID && createdSessionForExecution) {
      subagentSessions.delete(sessionID)
      syncSubagentSessions.delete(sessionID)
    }
  }
}
