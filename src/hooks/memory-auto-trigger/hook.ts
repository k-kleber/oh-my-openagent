import { basename } from "node:path"
import type { PluginInput } from "@opencode-ai/plugin"
import { getSessionAgent } from "../../features/claude-code-session-state"
import { getAgentConfigKey } from "../../shared/agent-display-names"

const TARGET_AGENTS = new Set([
  "sisyphus",
  "sisyphus-junior",
  "atlas",
  "hephaestus",
  "researcher",
  "writer",
  "brainstormer",
])

const DISCOVERY_TOOLS = new Set([
  "read",
  "grep",
  "glob",
  "codesearch",
  "webfetch",
  "websearch",
  "google_search",
  "lsp_goto_definition",
  "lsp_find_references",
  "lsp_symbols",
  "ast_grep_search",
  "task",
])

const CAPTURE_COOLDOWN_MS = 5 * 60 * 1000
const RECALL_COOLDOWN_MS = 60 * 1000
const MIN_OUTPUT_CHARS = 280
const SESSION_BUDGET_CHARS = 500
const RECALL_MAX_PER_SESSION = 1
const CAPTURE_MAX_PER_SESSION = 3
const FAILURE_PAUSE_MS = 5 * 60 * 1000

const MEMORY_RECALL_TAG = "MEMORY AUTO-RECALL"
const MEMORY_CAPTURE_TAG = "MEMORY AUTO-CAPTURE"

interface MemorySessionState {
  recallCount: number
  captureCount: number
  budgetUsed: number
  lastRecallAt?: number
  lastCaptureAt?: number
  consecutiveFailures: number
  pausedUntil?: number
}

interface ChatMessageInput {
  sessionID: string
  agent?: string
}

interface ChatMessageOutput {
  parts: Array<{ type: string; text?: string }>
}

interface ToolExecuteInput {
  tool: string
  sessionID: string
  callID: string
  agent?: string
}

interface ToolExecuteOutput {
  title: string
  output: string
  metadata: Record<string, unknown>
}

interface EventInput {
  event: {
    type: string
    properties?: unknown
  }
}

export function createMemoryAutoTriggerHook(ctx: PluginInput) {
  const states = new Map<string, MemorySessionState>()

  const projectPath = ctx.directory
  const projectName = basename(projectPath || process.cwd())

  function getState(sessionID: string): MemorySessionState {
    const existing = states.get(sessionID)
    if (existing) return existing
    const created: MemorySessionState = {
      recallCount: 0,
      captureCount: 0,
      budgetUsed: 0,
      consecutiveFailures: 0,
    }
    states.set(sessionID, created)
    return created
  }

  function canSpend(state: MemorySessionState, chars: number): boolean {
    return state.budgetUsed + chars <= SESSION_BUDGET_CHARS
  }

  function isPaused(state: MemorySessionState, now: number): boolean {
    return typeof state.pausedUntil === "number" && now < state.pausedUntil
  }

  function trackMemoryTaskOutcome(state: MemorySessionState, outputText: string, now: number): void {
    const lower = outputText.toLowerCase()
    const isMemoryTaskResult = lower.includes("memory-retrieval") || lower.includes("memory-store")
    if (!isMemoryTaskResult) return

    const failed = outputText.startsWith("Error:") || outputText.startsWith("Failed")
    if (!failed) {
      state.consecutiveFailures = 0
      state.pausedUntil = undefined
      return
    }

    state.consecutiveFailures += 1
    if (state.consecutiveFailures >= 3) {
      state.pausedUntil = now + FAILURE_PAUSE_MS
    }
  }

  function isTargetAgent(sessionID: string, inputAgent?: string): boolean {
    const resolvedAgent = getSessionAgent(sessionID) ?? inputAgent
    if (!resolvedAgent) return true
    return TARGET_AGENTS.has(getAgentConfigKey(resolvedAgent))
  }

  const chatMessage = async (input: ChatMessageInput, output: ChatMessageOutput): Promise<void> => {
    if (!isTargetAgent(input.sessionID, input.agent)) return

    const now = Date.now()
    const state = getState(input.sessionID)
    if (isPaused(state, now)) return
    if (state.recallCount >= RECALL_MAX_PER_SESSION) return
    if (typeof state.lastRecallAt === "number" && now - state.lastRecallAt < RECALL_COOLDOWN_MS) return

    const partIndex = output.parts.findIndex((part) => part.type === "text" && typeof part.text === "string")
    if (partIndex < 0) return
    const original = output.parts[partIndex]?.text ?? ""
    if (original.includes(MEMORY_RECALL_TAG)) return

    const memoryRecallBlock = `\n\n<system-reminder>\nMEMORY AUTO-RECALL:\ntask(subagent_type="memory-retrieval", load_skills=["memory-mcp"], description="Retrieve memory", prompt="Recall and verify memory relevant to: ${original.slice(0, 180)}\\nProject: ${projectPath} (${projectName})", run_in_background=false)\nUse only verified items.\n</system-reminder>`
    if (!canSpend(state, memoryRecallBlock.length)) return

    output.parts[partIndex].text = `${original}${memoryRecallBlock}`
    state.recallCount += 1
    state.lastRecallAt = now
    state.budgetUsed += memoryRecallBlock.length
  }

  const toolExecuteAfter = async (input: ToolExecuteInput, output: ToolExecuteOutput): Promise<void> => {
    const now = Date.now()
    const state = getState(input.sessionID)
    const outputText = output.output ?? ""
    trackMemoryTaskOutcome(state, outputText, now)

    if (!isTargetAgent(input.sessionID, input.agent)) return

    const toolName = input.tool.toLowerCase()
    if (!DISCOVERY_TOOLS.has(toolName)) return
    if (isPaused(state, now)) return
    if (state.captureCount >= CAPTURE_MAX_PER_SESSION) return
    if (toolName === "task" && (outputText.includes(MEMORY_CAPTURE_TAG) || outputText.includes(MEMORY_RECALL_TAG))) return

    if (!outputText || outputText.startsWith("Error:") || outputText.startsWith("Failed")) return
    if (toolName !== "task" && outputText.length < MIN_OUTPUT_CHARS) return
    if (outputText.includes(MEMORY_CAPTURE_TAG)) return

    const last = state.lastCaptureAt ?? 0
    if (now - last < CAPTURE_COOLDOWN_MS) return

    const memoryCaptureBlock = `\n\n<system-reminder>\nMEMORY AUTO-CAPTURE:\ntask(subagent_type="memory-store", load_skills=["memory-mcp"], description="Store discoveries", prompt="Project: ${projectPath} (${projectName})\\nObservations:\\n- <insight 1 <=100 chars>\\n- <insight 2 <=100 chars>\\n- <insight 3 <=100 chars>", run_in_background=true)\nStore only non-obvious, actionable, certain insights.\n</system-reminder>`
    if (!canSpend(state, memoryCaptureBlock.length)) return

    output.output = `${outputText}${memoryCaptureBlock}`
    state.captureCount += 1
    state.lastCaptureAt = now
    state.budgetUsed += memoryCaptureBlock.length
  }

  const event = async ({ event }: EventInput): Promise<void> => {
    const props = event.properties as Record<string, unknown> | undefined
    if (event.type !== "session.deleted" && event.type !== "session.compacted") return
    const info = props?.info as { id?: string } | undefined
    const sessionID = info?.id ?? (props?.sessionID as string | undefined)
    if (!sessionID) return
    states.delete(sessionID)
  }

  return {
    "chat.message": chatMessage,
    "tool.execute.after": toolExecuteAfter,
    event,
  }
}
