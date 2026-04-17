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
      const filePath = (output.args.filePath ?? output.args.path ?? output.args.file) as
        | string
        | undefined
      if (!filePath) {
        // No file path - block the tool
        if (normalizedTool === "write") {
          throw new Error(
            `[${HOOK_NAME}] Brainstormer can only create new brainstorm/notes/research files. Write without file path not allowed.`,
          )
        }
        if (normalizedTool === "edit" || normalizedTool === "apply_patch" || normalizedTool === "patch" || normalizedTool === "hashline_edit") {
          throw new Error(
            `[${HOOK_NAME}] Brainstormer is read-only. Tool not allowed: ${input.tool}`,
          )
        }
        return
      }

      // Check if the file path is in allowed patterns
      if (!isAllowedFile(filePath, ctx.directory)) {
        log(`[${HOOK_NAME}] Blocked: Brainstormer can only write to .sisyphus/drafts/*.{brainstorm,notes,research}*.md`, {
          sessionID: input.sessionID,
          tool: input.tool,
          filePath,
          agent: agentName,
        })
        throw new Error(
          `[${HOOK_NAME}] Brainstormer can only create new brainstorm/notes/research files. `.concat(
            `Allowed: .sisyphus/drafts/brainstorm*.md, .sisyphus/drafts/notes-*.md, .sisyphus/drafts/research-*.md. `,
            `Attempted: ${filePath}`,
          ),
        )
      }

      // Check if file already exists (only allow new file creation)
      const absolutePath = resolve(ctx.directory, filePath)
      if (existsSync(absolutePath)) {
        throw new Error(
          `[${HOOK_NAME}] Brainstormer may only create new files. Existing file detected: ${filePath}`,
        )
      }

      // Write is allowed for new files in allowed patterns
      // Edit/Patch tools still blocked (can't modify existing files)
      if (normalizedTool === "edit" || normalizedTool === "apply_patch" || normalizedTool === "patch" || normalizedTool === "hashline_edit") {
        throw new Error(
          `[${HOOK_NAME}] Brainstormer is read-only. Cannot modify files. Tool not allowed: ${input.tool}`,
        )
      }

      // Write to new allowed file is permitted - log for debugging
      log(`[${HOOK_NAME}] Allowed: Brainstormer creating new file`, {
        sessionID: input.sessionID,
        tool: input.tool,
        filePath,
        agent: agentName,
      })
    },
  }
}
