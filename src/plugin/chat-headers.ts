import type { PluginContext } from "./types"

type ChatHeadersInput = {
  sessionID: string
  provider: { id: string }
  message: {
    id?: string
    role?: string
  }
}

type ChatHeadersOutput = {
  headers: Record<string, string>
}

// Tracks sessions where the billing handshake (first x-initiator:user) has been sent.
// For in-process sessions, subsequent messages get x-initiator:agent automatically.
const billedSessionSet = new Set<string>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function buildChatHeadersInput(raw: unknown): ChatHeadersInput | null {
  if (!isRecord(raw)) return null

  const sessionID = raw.sessionID
  const provider = raw.provider
  const message = raw.message

  if (typeof sessionID !== "string") return null
  if (!isRecord(provider) || typeof provider.id !== "string") return null
  if (!isRecord(message)) return null

  return {
    sessionID,
    provider: { id: provider.id },
    message: {
      id: typeof message.id === "string" ? message.id : undefined,
      role: typeof message.role === "string" ? message.role : undefined,
    },
  }
}

function isChatHeadersOutput(raw: unknown): raw is ChatHeadersOutput {
  if (!isRecord(raw)) return false
  if (!isRecord(raw.headers)) {
    raw.headers = {}
  }
  return isRecord(raw.headers)
}

function isCopilotProvider(providerID: string): boolean {
  return providerID === "github-copilot" || providerID === "github-copilot-enterprise"
}

function getMessageID(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.id === "string") return value.id

  const info = value.info
  if (isRecord(info) && typeof info.id === "string") {
    return info.id
  }

  return undefined
}

// Queries how many messages already exist in a session before the current one.
// Some runtimes persist the in-flight message before chat.headers runs, so we
// exclude the current message ID from the count.
async function getPriorMessageCount(
  client: PluginContext["client"],
  sessionID: string,
  currentMessageID?: string,
): Promise<number> {
  try {
    const resp = await client.session.messages({ path: { id: sessionID } })
    const data = resp.data
    if (!Array.isArray(data)) return 0

    if (!currentMessageID) {
      return data.length
    }

    return data.filter((message) => {
      return getMessageID(message) !== currentMessageID
    }).length
  } catch {
    return 0
  }
}

// Call this from event.ts for sessions confirmed to have already been billed
// (e.g., external sessions that existed before the plugin loaded).
export function markSessionBilled(sessionID: string): void {
  billedSessionSet.add(sessionID)
}

export function createChatHeadersHandler(_args: { ctx: PluginContext }): (input: unknown, output: unknown) => Promise<void> {
  return async (input, output): Promise<void> => {
    const normalizedInput = buildChatHeadersInput(input)
    if (!normalizedInput) return
    if (!isChatHeadersOutput(output)) return

    if (!isCopilotProvider(normalizedInput.provider.id)) return

    // Do not override x-initiator when @ai-sdk/github-copilot is active.
    // OpenCode's copilot fetch wrapper already sets x-initiator based on
    // the actual request body content. Overriding it here causes a mismatch
    // that the Copilot API rejects with "invalid initiator".
    const model = isRecord(input) && isRecord((input as Record<string, unknown>).model)
      ? (input as Record<string, unknown>).model as Record<string, unknown>
      : undefined
    const api = model && isRecord(model.api) ? model.api as Record<string, unknown> : undefined
    const isSsdkActive = api?.npm === "@ai-sdk/github-copilot"

    const sessionID = normalizedInput.sessionID

    // Determine if this is the billing handshake message:
    // 1. in-process deduplication: if we already marked this session, it's NOT the first
    // 2. server-restart safety net: if prior session messages exist, the session
    //    already has history (from before this server process) → NOT the first
    const alreadyBilled = billedSessionSet.has(sessionID)
    const priorMessageCount = await getPriorMessageCount(
      _args.ctx.client,
      sessionID,
      normalizedInput.message.id,
    )
    const isFirstBillingMessage = !alreadyBilled && priorMessageCount === 0

    if (isSsdkActive) {
      // When @ai-sdk/github-copilot is active, the SDK sets x-initiator internally.
      // Only set agent headers when this is NOT the first billing message.
      if (!isFirstBillingMessage) {
        output.headers["x-initiator"] = "agent"
        output.headers["x-copilot-is-agent"] = "true"
        output.headers["openai-is-agent"] = "true"
      }
      // Mark billed so subsequent calls don't re-enter the billing path.
      billedSessionSet.add(sessionID)
      // For the first message we return early so the SDK's own x-initiator logic is
      // preserved — it will correctly set "user" and trigger the billing handshake.
      return
    }

    // Non-SSSD path (direct API calls, e.g. the `run` CLI command):
    // - First message: x-initiator: "user" → server bills 1 premium request
    // - All subsequent messages: x-initiator: "agent" → zero additional charges
    if (isFirstBillingMessage) {
      billedSessionSet.add(sessionID)
      output.headers["x-initiator"] = "user"
    } else {
      output.headers["x-initiator"] = "agent"
      output.headers["x-copilot-is-agent"] = "true"
      output.headers["openai-is-agent"] = "true"
    }
  }
}
