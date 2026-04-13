import { basename } from "node:path"
import type { PluginInput } from "@opencode-ai/plugin"
import { getSessionAgent, subagentSessions } from "../../features/claude-code-session-state"
import type { MemoryConfig } from "../../config"
import { AGENT_DISPLAY_NAMES, getAgentConfigKey } from "../../shared/agent-display-names"
import { createInternalAgentTextPart } from "../../shared/internal-initiator-marker"
import { log } from "../../shared/logger"
import { createMemoryMetricsState, type MemoryMetricsState } from "./metrics"
import { persistMemoryMetrics } from "./persistent-metrics"
import type { SkillMcpManager } from "../../features/skill-mcp-manager"
import { MemoryOrchestrator } from "../../features/memory-orchestrator"

const TARGET_AGENTS = new Set(Object.keys(AGENT_DISPLAY_NAMES))

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
const MEMORY_PRECOMPACTION_TAG = "MEMORY AUTO-PRECOMPACTION"
const MEMORY_SESSION_IDLE_TAG = "MEMORY AUTO-SESSION-IDLE"
const MEMORY_SESSION_COMPACTED_TAG = "MEMORY AUTO-SESSION-COMPACTED"

const DEFAULT_ALLOWED_SCOPES = ["project", "system", "framework", "global", "user"] as const

type MemoryScope = typeof DEFAULT_ALLOWED_SCOPES[number]

interface MemorySessionState {
  recallCount: number
  captureCount: number
  lifecycleCaptureCount: number
  budgetUsed: number
  memoryTaskDepth: number
  observations: string[]
  promotionCandidates: string[]
  recentTools: string[]
  metrics: MemoryMetricsState
  lastRecallAt?: number
  lastCaptureAt?: number
  lastIdleCaptureAt?: number
  lastCompactedCaptureAt?: number
  lastPrecompactionCaptureAt?: number
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

function formatRecallLine(item: {
  verification: string
  source: string
  content: string
  evidence?: { path?: string; line?: number }
}): string {
  const status = item.verification.replace(/_/g, "-")
  const base = `- [${status}] (${item.source}) ${item.content}`
  if (!item.evidence?.path) return base
  const location = typeof item.evidence.line === "number"
    ? `${item.evidence.path}:${item.evidence.line}`
    : item.evidence.path
  return `${base} [evidence: ${location}]`
}

export function createMemoryAutoTriggerHook(ctx: PluginInput, memoryConfig?: MemoryConfig, skillMcpManager?: SkillMcpManager) {

  const memoryEnabled = memoryConfig?.enabled ?? true
  const targetAgents = new Set(memoryConfig?.target_agents ?? TARGET_AGENTS)
  const recallCooldownMs = memoryConfig?.retrieval?.cooldown_ms ?? RECALL_COOLDOWN_MS
  const recallMaxPerSession = memoryConfig?.retrieval?.max_per_session ?? RECALL_MAX_PER_SESSION
  const recallMaxQueryChars = memoryConfig?.retrieval?.max_query_chars ?? 180
  const recallRunInBackground = memoryConfig?.retrieval?.run_in_background ?? false

  const captureEnabled = memoryConfig?.capture?.enabled ?? true
  const captureCooldownMs = memoryConfig?.capture?.cooldown_ms ?? CAPTURE_COOLDOWN_MS
  const captureMaxPerSession = memoryConfig?.capture?.max_per_session ?? CAPTURE_MAX_PER_SESSION
  const minOutputChars = memoryConfig?.capture?.min_output_chars ?? MIN_OUTPUT_CHARS
  const maxInsights = memoryConfig?.capture?.max_insights ?? 3
  const maxInsightChars = memoryConfig?.capture?.max_insight_chars ?? 100
  const captureRunInBackground = memoryConfig?.capture?.run_in_background ?? true
  const discoveryTools = new Set(memoryConfig?.capture?.discovery_tools ?? DISCOVERY_TOOLS)

  const observationLedgerEnabled = memoryConfig?.observation_ledger?.enabled ?? true
  const observationLedgerMaxEntries = memoryConfig?.observation_ledger?.max_entries_per_session ?? 25
  const observationLedgerSampleWindow = memoryConfig?.observation_ledger?.sample_window ?? 5
  const observationLedgerMinOutputChars = memoryConfig?.observation_ledger?.min_output_chars ?? minOutputChars
  const observationLedgerCaptureToolInputs = memoryConfig?.observation_ledger?.capture_tool_inputs ?? false

  const reducerEnabled = memoryConfig?.reducer?.enabled ?? true
  const reducerConfidenceThreshold = memoryConfig?.reducer?.confidence_threshold ?? 0.8
  const reducerPromotionThreshold = memoryConfig?.reducer?.promotion_threshold ?? 0.92
  const reducerMinEvidenceCount = memoryConfig?.reducer?.min_evidence_count ?? 2
  const reducerCrossProjectEvidenceMin = memoryConfig?.reducer?.cross_project_evidence_min ?? 3
  const reducerRunOnLifecycleEvents = memoryConfig?.reducer?.run_on_lifecycle_events ?? true
  const reducerRunOnToolCapture = memoryConfig?.reducer?.run_on_tool_capture ?? true

  const observabilityEnabled = memoryConfig?.observability?.enabled ?? true
  const observabilityLogMetrics = memoryConfig?.observability?.log_metrics ?? true
  const observabilityIncludeSessionSummaryOnDelete = memoryConfig?.observability?.include_session_summary_on_delete ?? true

  const sessionBudgetChars = memoryConfig?.budget?.session_chars ?? SESSION_BUDGET_CHARS
  const pauseAfterFailures = memoryConfig?.budget?.pause_after_failures ?? 3
  const failurePauseMs = memoryConfig?.budget?.failure_pause_ms ?? FAILURE_PAUSE_MS

  const lifecycleCaptureOnIdle = memoryConfig?.lifecycle?.capture_on_session_idle ?? true
  const lifecycleCaptureOnCompacted = memoryConfig?.lifecycle?.capture_on_session_compacted ?? true
  const lifecycleCaptureOnPrecompaction = memoryConfig?.lifecycle?.capture_on_preemptive_compaction ?? true
  const lifecycleIdleCooldownMs = memoryConfig?.lifecycle?.idle_cooldown_ms ?? CAPTURE_COOLDOWN_MS

  const taxonomyEnabled = memoryConfig?.taxonomy?.enabled ?? true
  const taxonomyDefaultScope = memoryConfig?.taxonomy?.default_scope ?? "project"
  const allowedScopes = new Set(memoryConfig?.taxonomy?.allowed_scopes ?? DEFAULT_ALLOWED_SCOPES)

  function resolveScope(): MemoryScope {
    const candidate = taxonomyEnabled ? taxonomyDefaultScope : "project"
    if (allowedScopes.has(candidate as MemoryScope)) {
      return candidate as MemoryScope
    }
    return "project"
  }

  function buildScopePromptLine(): string {
    const scopes = Array.from(allowedScopes)
    return `Scope: ${resolveScope()}\\nAllowed scopes: ${scopes.join(", ")}`
  }

  const states = new Map<string, MemorySessionState>()
  const orchestrator = skillMcpManager ? new MemoryOrchestrator(skillMcpManager) : null

  const projectPath = ctx.directory
  const projectName = basename(projectPath || process.cwd())

  function getState(sessionID: string): MemorySessionState {
    const existing = states.get(sessionID)
    if (existing) return existing
    const created: MemorySessionState = {
      recallCount: 0,
      captureCount: 0,
      lifecycleCaptureCount: 0,
      budgetUsed: 0,
      memoryTaskDepth: 0,
      observations: [],
      promotionCandidates: [],
      recentTools: [],
      metrics: createMemoryMetricsState(),
      consecutiveFailures: 0,
    }
    states.set(sessionID, created)
    return created
  }

  function canSpend(state: MemorySessionState, chars: number): boolean {
    return state.budgetUsed + chars <= sessionBudgetChars
  }

  function isPaused(state: MemorySessionState, now: number): boolean {
    return typeof state.pausedUntil === "number" && now < state.pausedUntil
  }

  function trackMemoryTaskOutcome(state: MemorySessionState, outputText: string, now: number): void {
    const lower = outputText.toLowerCase()
    const isMemoryTaskResult = lower.includes("memory-retrieval") || lower.includes("memory-store")
    if (!isMemoryTaskResult) return

    const failed = outputText.startsWith("Error:") || outputText.startsWith("Failed")
    state.memoryTaskDepth = 0
    state.metrics.memoryTaskResets += 1
    if (!failed) {
      state.consecutiveFailures = 0
      state.pausedUntil = undefined
      return
    }

    state.consecutiveFailures += 1
    if (state.consecutiveFailures >= pauseAfterFailures) {
      state.pausedUntil = now + failurePauseMs
    }
  }

  function isMemoryTaskActive(state: MemorySessionState): boolean {
    return state.memoryTaskDepth > 0
  }

  function enterMemoryTask(state: MemorySessionState): boolean {
    if (isMemoryTaskActive(state)) return false
    state.memoryTaskDepth += 1
    return true
  }

  function pushObservation(state: MemorySessionState, observation: string): void {
    if (!observationLedgerEnabled) return
    if (!observation) return
    state.observations.push(observation)
    state.metrics.observationsCaptured += 1
    if (state.observations.length > observationLedgerMaxEntries) {
      state.observations.splice(0, state.observations.length - observationLedgerMaxEntries)
    }
  }

  function trackRecentTool(state: MemorySessionState, toolName: string): void {
    state.recentTools.push(toolName)
    if (state.recentTools.length > 5) {
      state.recentTools.splice(0, state.recentTools.length - 5)
    }
  }

  function maybeRecordPromotionCandidate(state: MemorySessionState): void {
    const recentObservations = state.observations.slice(-observationLedgerSampleWindow)
    if (recentObservations.length < reducerCrossProjectEvidenceMin) return

    const normalized = recentObservations
      .map((entry) => entry.split("->")[0]?.trim() ?? entry)
      .filter(Boolean)
    const uniqueSignals = new Set(normalized)
    if (uniqueSignals.size < reducerCrossProjectEvidenceMin) return

    const candidate = `cross-project-candidate:${Array.from(uniqueSignals).sort().join("|")}`
    if (state.promotionCandidates.includes(candidate)) return

    state.promotionCandidates.push(candidate)
    state.metrics.promotionCandidatesSuggested += 1
    if (reducerPromotionThreshold <= 1) {
      state.metrics.promotionThresholdHits += 1
    }
  }

  function emitMetricsLog(sessionID: string, state: MemorySessionState, reason: string): void {
    if (!observabilityEnabled || !observabilityLogMetrics) return
    persistMemoryMetrics(sessionID, state.metrics)
    log("[memory-metrics] session", {
      sessionID,
      reason,
      observations: state.observations.length,
      promotionCandidates: state.promotionCandidates.length,
      metrics: state.metrics,
    })
  }

  function buildReducerCandidatesBlock(state: MemorySessionState): string {
    const observations = state.observations.slice(-observationLedgerSampleWindow)
    if (observations.length < reducerMinEvidenceCount) return ""
    state.metrics.reducerEligibleEvents += 1
    state.metrics.reducerCandidatesSuggested += 1
    maybeRecordPromotionCandidate(state)
    const promotionLines = state.promotionCandidates.length > 0
      ? `\nPromotion candidates:\n${state.promotionCandidates.map((entry) => `- ${entry}`).join("\n")}`
      : ""
    return `\nReducer candidates:\n- derive confidence-scored candidates from these observations:\n${observations.map((entry) => `- ${entry}`).join("\n")}`
      + promotionLines
  }

  function buildObservationSummary(input: ToolExecuteInput, outputText: string): string {
    const trimmedOutput = outputText.replace(/\s+/g, " ").trim().slice(0, maxInsightChars)
    const inputSummary = observationLedgerCaptureToolInputs ? ` call:${input.callID}` : ""
    return `${input.tool.toLowerCase()}${inputSummary} -> ${trimmedOutput}`
  }

  function isTargetAgent(sessionID: string, inputAgent?: string): boolean {
    if (subagentSessions.has(sessionID)) return true
    const resolvedAgent = getSessionAgent(sessionID) ?? inputAgent
    if (!resolvedAgent) return true
    return targetAgents.has(getAgentConfigKey(resolvedAgent))
  }

  function buildCaptureBlock(args: {
    tag: string
    description: string
    reason: string
    state?: MemorySessionState
  }): string {
    const observations = Array.from({ length: maxInsights }, (_, index) => `- <insight ${index + 1} <=${maxInsightChars} chars>`).join("\\n")
    const scopeLine = buildScopePromptLine()
    const reducerLines = args.state && reducerEnabled
      ? buildReducerCandidatesBlock(args.state)
      : ""
    return `\n\n<system-reminder>\n${args.tag}:\nNative memory orchestrator active.\nProject: ${projectPath} (${projectName})\\nReason: ${args.reason}\\n${scopeLine}\\nReducer threshold: ${reducerConfidenceThreshold}\\nPromotion threshold: ${reducerPromotionThreshold}\\nMinimum evidence count: ${reducerMinEvidenceCount}${reducerLines}\\nObservations:\\n${observations}\n</system-reminder>`
  }

  function estimateCaptureBlockLength(state: MemorySessionState): number {
    return buildCaptureBlock({
      tag: MEMORY_CAPTURE_TAG,
      description: "Store discoveries",
      reason: "tool.execute.after:estimate",
      state,
    }).length
  }

  async function injectLifecycleCapturePrompt(args: {
    sessionID: string
    state: MemorySessionState
    now: number
    reason: string
    tag: string
    setTimestamp: (state: MemorySessionState, now: number) => void
  }): Promise<void> {
    if (!memoryEnabled || !captureEnabled) return
    if (isPaused(args.state, args.now)) return
    if (args.state.captureCount >= captureMaxPerSession) return
    if (reducerEnabled && args.state.observations.length < reducerMinEvidenceCount) return
    if (!enterMemoryTask(args.state)) return

    if (!orchestrator) return

    const recentObservations = args.state.observations.slice(-observationLedgerSampleWindow)
    await orchestrator.store({
      sessionID: args.sessionID,
      projectPath,
      projectName,
      reason: args.reason,
      scope: resolveScope(),
      allowedScopes: Array.from(allowedScopes),
      observations: recentObservations,
      confidenceThreshold: reducerConfidenceThreshold,
      promotionThreshold: reducerPromotionThreshold,
      crossProjectEvidenceMin: reducerCrossProjectEvidenceMin,
    })

    args.state.captureCount += 1
    args.state.lifecycleCaptureCount += 1
    args.state.metrics.lifecycleCapturesTriggered += 1
    args.state.budgetUsed += estimateCaptureBlockLength(args.state)
    args.setTimestamp(args.state, args.now)
    emitMetricsLog(args.sessionID, args.state, args.reason)
  }

  const chatMessage = async (input: ChatMessageInput, output: ChatMessageOutput): Promise<void> => {
    if (!memoryEnabled) return
    if (!isTargetAgent(input.sessionID, input.agent)) return

    const now = Date.now()
    const state = getState(input.sessionID)
    if (isPaused(state, now)) return
    if (isMemoryTaskActive(state)) return
    if (state.recallCount >= recallMaxPerSession) return
    if (typeof state.lastRecallAt === "number" && now - state.lastRecallAt < recallCooldownMs) return

    const partIndex = output.parts.findIndex((part) => part.type === "text" && typeof part.text === "string")
    if (partIndex < 0) return
    const original = output.parts[partIndex]?.text ?? ""
    if (original.includes(MEMORY_RECALL_TAG)) return

    if (orchestrator) {
      const result = await orchestrator.recall({
        sessionID: input.sessionID,
        projectPath,
        projectName,
        query: original.slice(0, recallMaxQueryChars),
        scope: resolveScope(),
        agentName: input.agent,
        recentTools: state.recentTools,
      })
      log("[memory-auto] recall_result", {
        sessionID: input.sessionID,
        hits: result.hits,
        items: result.items.length,
        agent: input.agent,
      })
      if (result.hits === 0) return

      const recallLines = result.items
        .map((item) => formatRecallLine(item))
        .join("\n")
      const nativeRecallBlock = `\n\n<system-reminder>\nMEMORY AUTO-RECALL:\n${recallLines}\nUse only verified items.\n</system-reminder>`
      if (!canSpend(state, nativeRecallBlock.length)) return

      output.parts[partIndex].text = `${original}${nativeRecallBlock}`
      state.metrics.retrievalHits += result.hits
      state.recallCount += 1
      state.lastRecallAt = now
      state.budgetUsed += nativeRecallBlock.length
      log("[memory-auto] recall_injected", {
        sessionID: input.sessionID,
        recallCount: state.recallCount,
        budgetUsed: state.budgetUsed,
      })
      return
    }

    const scopeLine = buildScopePromptLine()
    const memoryRecallBlock = `\n\n<system-reminder>\nMEMORY AUTO-RECALL:\ntask(subagent_type="memory-retrieval", load_skills=[], description="Retrieve memory", prompt="Recall and verify memory relevant to: ${original.slice(0, recallMaxQueryChars)}\\nProject: ${projectPath} (${projectName})\\n${scopeLine}", run_in_background=${recallRunInBackground})\nUse only verified items.\n</system-reminder>`
    if (!canSpend(state, memoryRecallBlock.length)) return

    output.parts[partIndex].text = `${original}${memoryRecallBlock}`
    state.recallCount += 1
    state.lastRecallAt = now
    state.budgetUsed += memoryRecallBlock.length
  }

  const toolExecuteAfter = async (input: ToolExecuteInput, output: ToolExecuteOutput): Promise<void> => {
    if (!memoryEnabled) return
    const now = Date.now()
    const state = getState(input.sessionID)
    const outputText = output.output ?? ""
    trackMemoryTaskOutcome(state, outputText, now)

    if (!isTargetAgent(input.sessionID, input.agent)) return

    const toolName = input.tool.toLowerCase()
    trackRecentTool(state, toolName)
    if (!captureEnabled) return
    if (!discoveryTools.has(toolName)) return
    if (isPaused(state, now)) return
    if (isMemoryTaskActive(state)) return
    if (state.captureCount >= captureMaxPerSession) return
    if (toolName === "task" && (outputText.includes(MEMORY_CAPTURE_TAG) || outputText.includes(MEMORY_RECALL_TAG))) return

    if (!outputText || outputText.startsWith("Error:") || outputText.startsWith("Failed")) return
    if (toolName !== "task" && outputText.length < minOutputChars) return
    if (observationLedgerEnabled && outputText.length >= observationLedgerMinOutputChars) {
      pushObservation(state, buildObservationSummary(input, outputText))
    }
    if (outputText.includes(MEMORY_CAPTURE_TAG)) return

    const last = state.lastCaptureAt ?? 0
    if (now - last < captureCooldownMs) return

    if (reducerEnabled && state.observations.length < reducerMinEvidenceCount) return
    if (reducerEnabled && !reducerRunOnToolCapture) return
    const estimatedBlockLength = estimateCaptureBlockLength(state)
    if (!canSpend(state, estimatedBlockLength)) return
    if (!enterMemoryTask(state)) return

    let budgetIncrement = estimatedBlockLength
    if (orchestrator) {
      const result = await orchestrator.store({
        sessionID: input.sessionID,
        projectPath,
        projectName,
        reason: `tool.execute.after:${toolName}`,
        scope: resolveScope(),
        allowedScopes: Array.from(allowedScopes),
        observations: state.observations.slice(-observationLedgerSampleWindow),
        confidenceThreshold: reducerConfidenceThreshold,
        promotionThreshold: reducerPromotionThreshold,
        crossProjectEvidenceMin: reducerCrossProjectEvidenceMin,
      })
      log("[memory-auto] store_result", {
        sessionID: input.sessionID,
        tool: toolName,
        stored: result.stored.length,
        deduped: result.deduped.length,
        contradicted: result.contradicted.length,
        promoted: result.promoted.length,
      })
      output.output = `${outputText}\n[memory-orchestrator] stored=${result.stored.length} deduped=${result.deduped.length} contradicted=${result.contradicted.length} promoted=${result.promoted.length}`
    } else {
      const memoryCaptureBlock = buildCaptureBlock({
        tag: MEMORY_CAPTURE_TAG,
        description: "Store discoveries",
        reason: `tool.execute.after:${toolName}`,
        state,
      })
      output.output = `${outputText}${memoryCaptureBlock}`
      budgetIncrement = memoryCaptureBlock.length
    }
    state.captureCount += 1
    state.metrics.autoCapturesTriggered += 1
    state.lastCaptureAt = now
    state.budgetUsed += budgetIncrement
    log("[memory-auto] store_applied", {
      sessionID: input.sessionID,
      tool: toolName,
      captureCount: state.captureCount,
      budgetUsed: state.budgetUsed,
    })
    emitMetricsLog(input.sessionID, state, `tool.execute.after:${toolName}`)
  }

  const event = async ({ event }: EventInput): Promise<void> => {
    if (!memoryEnabled) return
    const props = event.properties as Record<string, unknown> | undefined

    if (event.type === "session.idle") {
      if (!lifecycleCaptureOnIdle || !captureEnabled) return
      const info = props?.info as { id?: string } | undefined
      const sessionID = info?.id ?? (props?.sessionID as string | undefined)
      if (!sessionID) return

      const state = getState(sessionID)
      const now = Date.now()
      const lastIdle = state.lastIdleCaptureAt ?? 0
      if (now - lastIdle < lifecycleIdleCooldownMs) return
      if (reducerEnabled && !reducerRunOnLifecycleEvents && state.observations.length < reducerMinEvidenceCount) return

      await injectLifecycleCapturePrompt({
        sessionID,
        state,
        now,
        reason: "session.idle",
        tag: MEMORY_SESSION_IDLE_TAG,
        setTimestamp: (nextState, timestamp) => {
          nextState.lastIdleCaptureAt = timestamp
          nextState.lastCaptureAt = timestamp
        },
      })
      return
    }

    if (event.type === "session.compacted") {
      const sessionID = (props?.sessionID as string | undefined)
        ?? (props?.info as { id?: string } | undefined)?.id
      if (!sessionID) return

      const source = typeof props?.source === "string" ? props.source : undefined
      if (lifecycleCaptureOnPrecompaction && captureEnabled && source === "preemptive-compaction") {
        const state = getState(sessionID)
        const now = Date.now()
        if (reducerEnabled && !reducerRunOnLifecycleEvents && state.observations.length < reducerMinEvidenceCount) return
        await injectLifecycleCapturePrompt({
          sessionID,
          state,
          now,
          reason: "session.compacted:preemptive-compaction",
          tag: MEMORY_PRECOMPACTION_TAG,
          setTimestamp: (nextState, timestamp) => {
            nextState.lastPrecompactionCaptureAt = timestamp
            nextState.lastCaptureAt = timestamp
          },
        })
        return
      }

      if (lifecycleCaptureOnCompacted && captureEnabled) {
        const state = getState(sessionID)
        const now = Date.now()
        if (reducerEnabled && !reducerRunOnLifecycleEvents && state.observations.length < reducerMinEvidenceCount) return
        await injectLifecycleCapturePrompt({
          sessionID,
          state,
          now,
          reason: "session.compacted",
          tag: MEMORY_SESSION_COMPACTED_TAG,
          setTimestamp: (nextState, timestamp) => {
            nextState.lastCompactedCaptureAt = timestamp
            nextState.lastCaptureAt = timestamp
          },
        })
      }
      return
    }

    if (event.type !== "session.deleted") return
    const info = props?.info as { id?: string } | undefined
    const sessionID = info?.id ?? (props?.sessionID as string | undefined)
    if (!sessionID) return
    const state = states.get(sessionID)
    if (state && observabilityIncludeSessionSummaryOnDelete) {
      emitMetricsLog(sessionID, state, "session.deleted")
      log("[memory-auto] session_summary", {
        sessionID,
        recallCount: state.recallCount,
        captureCount: state.captureCount,
        lifecycleCaptureCount: state.lifecycleCaptureCount,
        observations: state.observations.length,
        promotionCandidates: state.promotionCandidates.length,
        budgetUsed: state.budgetUsed,
      })
    }
    states.delete(sessionID)
  }

  return {
    "chat.message": chatMessage,
    "tool.execute.after": toolExecuteAfter,
    event,
  }
}
