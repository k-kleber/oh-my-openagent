import { tool, type PluginInput, type ToolDefinition } from "@opencode-ai/plugin"
import { ALLOWED_AGENTS, CALL_OMO_AGENT_DESCRIPTION } from "./constants"
import type { AllowedAgentType, CallOmoAgentArgs, ToolContextWithMetadata } from "./types"
import type { BackgroundManager } from "../../features/background-agent"
import type { CategoriesConfig, AgentOverrides } from "../../config/schema"
import type { FallbackEntry } from "../../shared/model-requirements"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared/model-requirements"
import { getAgentConfigKey } from "../../shared/agent-display-names"
import { getAgentDisplayName } from "../../shared/agent-display-names"
import { normalizeFallbackModels, flattenToFallbackModelStrings } from "../../shared/model-resolver"
import { buildFallbackChainFromModels } from "../../shared/fallback-chain-from-models"
import { normalizeSDKResponse } from "../../shared/normalize-sdk-response"
import { log } from "../../shared"
import { executeBackground } from "./background-executor"
import { executeSync } from "./sync-executor"
import { storeToolMetadata } from "../../features/tool-metadata-store"
import { resolveModelForDelegateTask } from "../delegate-task/model-selection"
import { normalizeModelFormat } from "../../shared/model-format-normalizer"

function resolveToolCallID(ctx: {
  callID?: string
  callId?: string
  call_id?: string
}): string | undefined {
  if (typeof ctx.callID === "string" && ctx.callID.trim() !== "") return ctx.callID
  if (typeof ctx.callId === "string" && ctx.callId.trim() !== "") return ctx.callId
  if (typeof ctx.call_id === "string" && ctx.call_id.trim() !== "") return ctx.call_id
  return undefined
}

type CachedCallResult = {
  result: string
  expiresAt: number
}

type ClientWithOptionalProviders = PluginInput["client"] & {
  app: PluginInput["client"]["app"] & {
    providers?: () => Promise<unknown>
  }
}

const CALL_DEDUP_TTL_MS = 45_000
const inFlightCalls = new Map<string, Promise<string>>()
const recentCallResults = new Map<string, CachedCallResult>()

function gcRecentCallResults(now = Date.now()): void {
  for (const [key, entry] of recentCallResults.entries()) {
    if (entry.expiresAt <= now) {
      recentCallResults.delete(key)
    }
  }
}

function resolveFallbackChainForCallOmoAgent(args: {
  subagentType: string
  agentOverrides?: AgentOverrides
  userCategories?: CategoriesConfig
}): FallbackEntry[] | undefined {
  const { subagentType, agentOverrides, userCategories } = args
  const agentConfigKey = getAgentConfigKey(subagentType)
  const agentRequirement = AGENT_MODEL_REQUIREMENTS[agentConfigKey]

  const agentOverride = agentOverrides?.[agentConfigKey as keyof AgentOverrides]
    ?? (agentOverrides
      ? Object.entries(agentOverrides).find(([key]) => key.toLowerCase() === agentConfigKey)?.[1]
      : undefined)

  const normalizedFallbackModels = normalizeFallbackModels(
    agentOverride?.fallback_models
    ?? (agentOverride?.category ? userCategories?.[agentOverride.category]?.fallback_models : undefined)
  )
  const defaultProviderID = agentRequirement?.fallbackChain?.[0]?.providers?.[0] ?? "opencode"
  const configuredFallbackChain = buildFallbackChainFromModels(normalizedFallbackModels, defaultProviderID)

  return configuredFallbackChain ?? agentRequirement?.fallbackChain
}

async function resolveModelForCallOmoAgent(args: {
  ctx: PluginInput
  subagentType: string
  runtimeMatchedModel?: string | { providerID: string; modelID: string }
  agentOverrides?: AgentOverrides
  userCategories?: CategoriesConfig
}): Promise<import("./types").CallOmoAgentModelConfig | undefined> {
  const { ctx, subagentType, runtimeMatchedModel, agentOverrides, userCategories } = args
  const agentConfigKey = getAgentConfigKey(subagentType)
  const agentRequirement = AGENT_MODEL_REQUIREMENTS[agentConfigKey]

  const agentOverride = agentOverrides?.[agentConfigKey as keyof AgentOverrides]
    ?? (agentOverrides
      ? Object.entries(agentOverrides).find(([key]) => key.toLowerCase() === agentConfigKey)?.[1]
      : undefined)

  const normalizedMatchedModel = runtimeMatchedModel
    ? normalizeModelFormat(runtimeMatchedModel)
    : undefined
  const matchedAgentModelStr = normalizedMatchedModel
    ? `${normalizedMatchedModel.providerID}/${normalizedMatchedModel.modelID}`
    : undefined

  const normalizedAgentFallbackModels = normalizeFallbackModels(
    agentOverride?.fallback_models
    ?? (agentOverride?.category ? userCategories?.[agentOverride.category]?.fallback_models : undefined)
  )

  const availableModels = new Set<string>()
  try {
    const providersFn = (ctx.client as ClientWithOptionalProviders).app.providers
    if (typeof providersFn === "function") {
      const providersResult = await providersFn()
      const providers = normalizeSDKResponse(providersResult, [] as Array<{ models?: string[] | Array<{ id?: string }> }>, {
        preferResponseOnMissingData: true,
      })
      for (const provider of providers) {
        for (const model of provider.models ?? []) {
          if (typeof model === "string") availableModels.add(model)
          else if (model?.id) availableModels.add(model.id)
        }
      }
    }
  } catch {
    // Best-effort only; resolver can still use explicit override/cold-cache fallback.
  }

  const resolution = resolveModelForDelegateTask({
    userModel: agentOverride?.model,
    userFallbackModels: flattenToFallbackModelStrings(normalizedAgentFallbackModels),
    categoryDefaultModel: matchedAgentModelStr,
    fallbackChain: agentRequirement?.fallbackChain,
    availableModels,
    systemDefaultModel: undefined,
  })

  const resolutionSkipped = resolution && "skipped" in resolution
  if (resolution && !resolutionSkipped) {
    const normalized = normalizeModelFormat(resolution.model)
    if (!normalized) return undefined
    const variant = agentOverride?.variant ?? resolution.variant
    return variant ? { ...normalized, variant } : normalized
  }

  if (resolutionSkipped && agentOverride?.model) {
    const normalized = normalizeModelFormat(agentOverride.model)
    if (!normalized) return undefined
    return agentOverride?.variant ? { ...normalized, variant: agentOverride.variant } : normalized
  }

  return normalizedMatchedModel
}

export function createCallOmoAgent(
  ctx: PluginInput,
  backgroundManager: BackgroundManager,
  disabledAgents: string[] = [],
  agentOverrides?: AgentOverrides,
  userCategories?: CategoriesConfig,
): ToolDefinition {
  const agentDescriptions = ALLOWED_AGENTS.map(
    (name) => `- ${name}: Specialized agent for ${name} tasks`
  ).join("\n")
  const description = CALL_OMO_AGENT_DESCRIPTION.replace("{agents}", agentDescriptions)

  return tool({
    description,
    args: {
      description: tool.schema.string().describe("A short (3-5 words) description of the task"),
      prompt: tool.schema.string().describe("The task for the agent to perform"),
      subagent_type: tool.schema
        .string()
        .describe("The type of specialized agent to use for this task (for example: explore, deep-explorer, librarian)"),
      run_in_background: tool.schema
        .boolean()
        .describe("REQUIRED. true: run asynchronously (use background_output to get results), false: run synchronously and wait for completion"),
      session_id: tool.schema.string().describe("Existing Task session to continue").optional(),
    },
    async execute(args: CallOmoAgentArgs, toolContext) {
      const toolCtx = toolContext as ToolContextWithMetadata
      log(`[call_omo_agent] Starting with agent: ${args.subagent_type}, background: ${args.run_in_background}`)

      if (getAgentConfigKey(toolCtx.agent ?? "") === "brainstormer") {
        return `Brainstormer cannot use call_omo_agent. Use task(subagent_type="explore"|"librarian"|"memory-retrieval") when needed.`
      }

      const requestedAgent = args.subagent_type.trim().replace(/^@+/, "")
      if (!requestedAgent) {
        return `Error: Invalid agent type "${args.subagent_type}". Only ${ALLOWED_AGENTS.join(", ")} are allowed.`
      }

      // Case-insensitive agent validation - allows "Explore", "EXPLORE", "explore" etc.
      if (
        !ALLOWED_AGENTS.some(
          (name) => name.toLowerCase() === requestedAgent.toLowerCase(),
        )
      ) {
        return `Error: Invalid agent type "${args.subagent_type}". Only ${ALLOWED_AGENTS.join(", ")} are allowed.`
      }

      const normalizedAgent = requestedAgent.toLowerCase() as AllowedAgentType
      args = { ...args, subagent_type: normalizedAgent }

      // Check if agent is disabled
      if (disabledAgents.some((disabled) => disabled.toLowerCase() === normalizedAgent)) {
        return `Error: Agent "${normalizedAgent}" is disabled via disabled_agents configuration. Remove it from disabled_agents in your oh-my-opencode.json to use it.`
      }

      if (typeof ctx.client?.app?.agents === "function") {
        try {
          type AgentInfo = { name: string; mode?: "subagent" | "primary" | "all"; model?: string | { providerID: string; modelID: string } }
          const agentsResult = await ctx.client.app.agents()
          const agents = normalizeSDKResponse(agentsResult, [] as AgentInfo[], {
            preferResponseOnMissingData: true,
          })

          const requestedDisplayName = getAgentDisplayName(normalizedAgent)
          const runtimeAgent = agents.find((agent) => {
            const name = agent.name.toLowerCase()
            return name === normalizedAgent || name === requestedDisplayName.toLowerCase()
          })

          if (runtimeAgent && runtimeAgent.mode !== "subagent") {
            return `Error: Cannot call non-subagent agent "${runtimeAgent.name}" via call_omo_agent. This tool only supports subagent-mode agents. Use workflow commands (e.g., /start-work, /start-planning, /start-writing) to switch primary agents.`
          }

          const resolvedModel = await resolveModelForCallOmoAgent({
            ctx,
            subagentType: normalizedAgent,
            runtimeMatchedModel: runtimeAgent?.model,
            agentOverrides,
            userCategories,
          })
          ;(args as CallOmoAgentArgs & { __resolvedModel?: import("./types").CallOmoAgentModelConfig }).__resolvedModel = resolvedModel
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return `Error: Failed to validate agent mode for "${normalizedAgent}": ${message}`
        }
      }

      const fallbackChain = resolveFallbackChainForCallOmoAgent({
        subagentType: args.subagent_type,
        agentOverrides,
        userCategories,
      })

      const callID = resolveToolCallID(toolCtx)
      const dedupeKey = callID && !args.session_id
        ? `${toolCtx.sessionID}:${callID}:${args.subagent_type}:${args.run_in_background ? "bg" : "sync"}`
        : undefined

      if (dedupeKey) {
        gcRecentCallResults()
        const cached = recentCallResults.get(dedupeKey)
        if (cached && cached.expiresAt > Date.now()) {
          return cached.result
        }

        const active = inFlightCalls.get(dedupeKey)
        if (active) {
          return await active
        }
      }

      const runCall = async (): Promise<string> => {
        if (args.run_in_background) {
          if (args.session_id) {
            return `Error: session_id is not supported in background mode. Use run_in_background=false to continue an existing session.`
          }
          const resolvedModel = (args as CallOmoAgentArgs & { __resolvedModel?: import("./types").CallOmoAgentModelConfig }).__resolvedModel
          const result = await executeBackground(args, toolCtx, backgroundManager, ctx.client, fallbackChain, resolvedModel)
          const backgroundTaskIdMatch = result.match(/Task ID: (bg_[a-zA-Z0-9_-]+)/)
          const sessionIdMatch = result.match(/Session ID: (ses_[a-zA-Z0-9_-]+)/)
          if (callID && sessionIdMatch?.[1]) {
            const metadata = {
              title: args.description,
              metadata: {
                prompt: args.prompt,
                agent: normalizedAgent,
                description: args.description,
                run_in_background: true,
                sessionId: sessionIdMatch[1],
                ...(backgroundTaskIdMatch?.[1] ? { backgroundTaskId: backgroundTaskIdMatch[1] } : {}),
              },
            }
            storeToolMetadata(toolCtx.sessionID, callID, metadata)
          }
          return result
        }

        if (!args.session_id) {
          let spawnReservation: Awaited<ReturnType<BackgroundManager["reserveSubagentSpawn"]>> | undefined
          try {
            spawnReservation = await backgroundManager.reserveSubagentSpawn(toolCtx.sessionID)
            const resolvedModel = (args as CallOmoAgentArgs & { __resolvedModel?: import("./types").CallOmoAgentModelConfig }).__resolvedModel
            return await executeSync(args, toolCtx, ctx, undefined, fallbackChain, spawnReservation, resolvedModel)
          } catch (error) {
            spawnReservation?.rollback()
            return `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        }

        const resolvedModel = (args as CallOmoAgentArgs & { __resolvedModel?: import("./types").CallOmoAgentModelConfig }).__resolvedModel
        return await executeSync(args, toolCtx, ctx, undefined, fallbackChain, undefined, resolvedModel)
      }

      if (!dedupeKey) {
        return await runCall()
      }

      const runPromise = runCall()
      inFlightCalls.set(dedupeKey, runPromise)

      try {
        const result = await runPromise
        recentCallResults.set(dedupeKey, {
          result,
          expiresAt: Date.now() + CALL_DEDUP_TTL_MS,
        })
        return result
      } finally {
        if (inFlightCalls.get(dedupeKey) === runPromise) {
          inFlightCalls.delete(dedupeKey)
        }
      }
    },
  })
}
