import type { PluginInput } from "@opencode-ai/plugin"
import { getSessionAgent } from "../../features/claude-code-session-state"
import { getAgentConfigKey } from "../../shared/agent-display-names"
import { log } from "../../shared/logger"
import { BRAINSTORMER_AGENT, BLOCKED_TOOLS, HOOK_NAME } from "./constants"
import { isAllowedFile } from "./path-policy"

export function createBrainstormerSisyphusMdOnlyHook(ctx: PluginInput) {
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> },
    ): Promise<void> => {
      const agentName = getSessionAgent(input.sessionID)
      if (!agentName) return

      if (getAgentConfigKey(agentName) !== BRAINSTORMER_AGENT) {
        return
      }

      if (!BLOCKED_TOOLS.includes(input.tool)) {
        return
      }

      const filePath = (output.args.filePath ?? output.args.path ?? output.args.file) as
        | string
        | undefined
      if (!filePath) return

      if (!isAllowedFile(filePath, ctx.directory)) {
        log(`[${HOOK_NAME}] Blocked: Brainstormer can only write to .sisyphus/*.md`, {
          sessionID: input.sessionID,
          tool: input.tool,
          filePath,
          agent: agentName,
        })
        throw new Error(
          `[${HOOK_NAME}] Brainstormer may only modify markdown files under .sisyphus/. ` +
            `Attempted: ${filePath}`,
        )
      }
    },
  }
}
