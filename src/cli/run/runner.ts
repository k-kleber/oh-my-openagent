import pc from "picocolors"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type { RunOptions, RunContext } from "./types"
import { createEventState, processEvents, serializeError } from "./events"
import { loadPluginConfig } from "../../plugin-config"
import { createServerConnection } from "./server-connection"
import { resolveSession } from "./session-resolver"
import { createJsonOutputManager } from "./json-output"
import { executeOnCompleteHook } from "./on-complete-hook"
import { resolveRunAgent } from "./agent-resolver"
import { resolveRunModel } from "./model-resolver"
import { pollForCompletion } from "./poll-for-completion"
import { loadAgentProfileColors } from "./agent-profile-colors"
import { suppressRunInput } from "./stdin-suppression"
import { createTimestampedStdoutController } from "./timestamp-output"
import { OMO_INTERNAL_INITIATOR_MARKER } from "../../shared"

export { resolveRunAgent }

const EVENT_PROCESSOR_SHUTDOWN_TIMEOUT_MS = 2_000

export async function waitForEventProcessorShutdown(
  eventProcessor: Promise<void>,
  timeoutMs = EVENT_PROCESSOR_SHUTDOWN_TIMEOUT_MS,
): Promise<void> {
  const completed = await Promise.race([
    eventProcessor.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ])

  void completed
}

/**
 * Gracefully reconcile the session with GitHub Copilot API before exit.
 * This sends a "Session Closed" signal so GitHub returns unused pre-auth credits.
 * Called on SIGINT/SIGTERM to prevent zombie sessions from holding credits hostage.
 */
async function reconcileGitHubSession(client: OpencodeClient, sessionID: string): Promise<void> {
  console.log(pc.dim("Reconciling session with GitHub..."))
  try {
    await client.session.delete({ path: { id: sessionID } })
    console.log(pc.green("Session closed cleanly."))
  } catch (error) {
    // Session may already be closed or not found — log and continue
    console.log(pc.yellow("Session reconciliation skipped:"), error instanceof Error ? error.message : String(error))
  }
}

export async function run(options: RunOptions): Promise<number> {
  process.env.OPENCODE_CLI_RUN_MODE = "true"
  process.env.OPENCODE_CLIENT = "run"

  const startTime = Date.now()
  const {
    message,
    directory = process.cwd(),
  } = options

  const jsonManager = options.json ? createJsonOutputManager() : null
  if (jsonManager) jsonManager.redirectToStderr()
  const timestampOutput = options.json || options.timestamp === false
    ? null
    : createTimestampedStdoutController()
  timestampOutput?.enable()

  const pluginConfig = loadPluginConfig(directory, { command: "run" })
  const resolvedAgent = resolveRunAgent(options, pluginConfig)
  const abortController = new AbortController()

  try {
    const resolvedModel = resolveRunModel(options.model)

    const { client, cleanup: serverCleanup } = await createServerConnection({
      port: options.port,
      attach: options.attach,
      signal: abortController.signal,
    })

    const cleanup = () => {
      serverCleanup()
    }

    // Declare early so shutdown handler can reference these
    let eventProcessor: Promise<void> = Promise.resolve()
    const restoreInput = suppressRunInput()

    // Named handler wrappers so removeListener can find the exact same reference
    const handleSigint = () => void handleGracefulShutdown("SIGINT")
    const handleSigterm = () => void handleGracefulShutdown("SIGTERM")

    // Attach named handlers before the inner try block
    process.on("SIGINT", handleSigint)
    process.on("SIGTERM", handleSigterm)

    // Graceful shutdown logic — async, calls process.exit at the end
    const handleGracefulShutdown = async (signal: "SIGINT" | "SIGTERM"): Promise<void> => {
      console.log(pc.yellow(`\n${signal} received. Shutting down gracefully...`))
      restoreInput()

      // Abort any in-progress operations
      abortController.abort()

      // Wait briefly for event processor to drain
      await waitForEventProcessorShutdown(eventProcessor)

      // Reconcile session with GitHub to return unused credits
      if (activeSessionID) {
        await reconcileGitHubSession(client, activeSessionID)
      }

      cleanup()
      // 130 = SIGINT exit code convention
      process.exit(128 + (signal === "SIGINT" ? 2 : 15))
    }

    // Track sessionID for graceful shutdown — may be null if SIGINT fires before session creation
    let activeSessionID: string | null = null

    try {
      const sessionID = await resolveSession({
        client,
        sessionId: options.sessionId,
        directory,
      })

      console.log(pc.dim(`Session: ${sessionID}`))

      // Track for graceful shutdown reconciliation
      activeSessionID = sessionID

      if (resolvedModel) {
        console.log(pc.dim(`Model: ${resolvedModel.providerID}/${resolvedModel.modelID}`))
      }

      const ctx: RunContext = {
        client,
        sessionID,
        directory,
        abortController,
        verbose: options.verbose ?? false,
      }
      const events = await client.event.subscribe({ query: { directory } })
      const eventState = createEventState()
      eventState.agentColorsByName = await loadAgentProfileColors(client)
      eventProcessor = processEvents(ctx, events.stream, eventState).catch(
        () => {},
      )

      // Default to a harmless prompt if message is empty so the payload is never null/empty.
      // Appending OMO_INTERNAL_INITIATOR_MARKER marks this as a handshake turn so the server
      // bills 1 credit (the Human-in-the-Loop handshake) and opens an "Agentic Session."
      // Subsequent agentic turns carry the marker and incur zero additional charges.
      const handshakeText = message.trim() || "Initializing agent session."
      const parts = [{ type: "text" as const, text: `${handshakeText}\n${OMO_INTERNAL_INITIATOR_MARKER}` }]

      await client.session.promptAsync({
        path: { id: sessionID },
        body: {
          agent: resolvedAgent,
          ...(resolvedModel ? { model: resolvedModel } : {}),
          tools: {
            question: false,
          },
          parts,
        },
        query: { directory },
      })
      const exitCode = await pollForCompletion(ctx, eventState, abortController)

      // Abort the event stream to stop the processor
      abortController.abort()

      await waitForEventProcessorShutdown(eventProcessor)
      cleanup()

      const durationMs = Date.now() - startTime

      if (options.onComplete) {
        await executeOnCompleteHook({
          command: options.onComplete,
          sessionId: sessionID,
          exitCode,
          durationMs,
          messageCount: eventState.messageCount,
        })
      }

      if (jsonManager) {
        jsonManager.emitResult({
          sessionId: sessionID,
          success: exitCode === 0,
          durationMs,
          messageCount: eventState.messageCount,
          summary: eventState.lastPartText.slice(0, 200) || "Run completed",
        })
      }

      return exitCode
    } catch (err) {
      cleanup()
      throw err
    } finally {
      process.removeListener("SIGINT", handleSigint)
      process.removeListener("SIGTERM", handleSigterm)
      restoreInput()
    }
  } catch (err) {
    if (jsonManager) jsonManager.restore()
    timestampOutput?.restore()
    if (err instanceof Error && err.name === "AbortError") {
      return 130
    }
    console.error(pc.red(`Error: ${serializeError(err)}`))
    return 1
  } finally {
    timestampOutput?.restore()
  }
}
