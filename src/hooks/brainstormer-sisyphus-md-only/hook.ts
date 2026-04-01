import type { PluginInput } from "@opencode-ai/plugin"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
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

      const normalizedTool = input.tool.toLowerCase()

      if (normalizedTool === "write") {
        throw new Error(
          `[${HOOK_NAME}] Brainstormer is read-only. Write is not allowed. Tool not allowed: ${input.tool}`,
        )
      }

      if (normalizedTool === "edit" || normalizedTool === "apply_patch" || normalizedTool === "patch") {
        throw new Error(
          `[${HOOK_NAME}] Brainstormer is read-only. ` +
            `Tool not allowed: ${input.tool}`,
        )
      }

      if (normalizedTool === "hashline_edit") {
        throw new Error(
          `[${HOOK_NAME}] Brainstormer is read-only. Tool not allowed: ${input.tool}`,
        )
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
          `[${HOOK_NAME}] Brainstormer is read-only. `.concat(
            `.sisyphus/drafts/brainstorm*.md or .sisyphus/drafts/brainstorms/brainstorm*.md. `,
            `Attempted: ${filePath}`,
          ),
        )
      }

      const absolutePath = resolve(ctx.directory, filePath)
      if (existsSync(absolutePath)) {
        throw new Error(
          `[${HOOK_NAME}] Brainstormer may only create new brainstorm handoff files. Existing file detected: ${filePath}`,
        )
      }
    },
  }
}
