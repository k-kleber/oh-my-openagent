import { tool, type PluginInput, type ToolDefinition } from "@opencode-ai/plugin"
import { ALLOWED_AGENTS, CALL_OMO_AGENT_DESCRIPTION } from "./constants"
import type { AllowedAgentType, CallOmoAgentArgs, ToolContextWithMetadata } from "./types"
import type { BackgroundManager } from "../../features/background-agent"
import type { CategoriesConfig, AgentOverrides } from "../../config/schema"
import type { FallbackEntry } from "../../shared/model-requirements"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared/model-requirements"
import { getAgentConfigKey } from "../../shared/agent-display-names"
import { getAgentDisplayName } from "../../shared/agent-display-names"
import { normalizeFallbackModels } from "../../shared/model-resolver"
import { buildFallbackChainFromModels } from "../../shared/fallback-chain-from-models"
import { normalizeSDKResponse } from "../../shared/normalize-sdk-response"
import { log } from "../../shared"
import { executeBackground } from "./background-executor"
import { executeSync } from "./sync-executor"

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
        .describe("The type of specialized agent to use for this task (explore or librarian only)"),
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
          type AgentInfo = { name: string; mode?: "subagent" | "primary" | "all" }
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

      if (args.run_in_background) {
        if (args.session_id) {
          return `Error: session_id is not supported in background mode. Use run_in_background=false to continue an existing session.`
        }
        return await executeBackground(args, toolCtx, backgroundManager, ctx.client, fallbackChain)
      }

      if (!args.session_id) {
        let spawnReservation: Awaited<ReturnType<BackgroundManager["reserveSubagentSpawn"]>> | undefined
        try {
          spawnReservation = await backgroundManager.reserveSubagentSpawn(toolCtx.sessionID)
          return await executeSync(args, toolCtx, ctx, undefined, fallbackChain, spawnReservation)
        } catch (error) {
          spawnReservation?.rollback()
          return `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      }

      return await executeSync(args, toolCtx, ctx, undefined, fallbackChain)
    },
  })
}
