import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { PluginInput } from "@opencode-ai/plugin"
import { updateSessionAgent } from "../../features/claude-code-session-state"
import { log } from "../../shared/logger"

export const HOOK_NAME = "start-planning" as const

interface StartPlanningHookInput {
  sessionID: string
  messageID?: string
}

interface StartPlanningHookOutput {
  parts: Array<{ type: string; text?: string }>
}

function extractUserRequest(promptText: string): string {
  const match = promptText.match(/<user-request>\s*([\s\S]*?)\s*<\/user-request>/i)
  if (!match) return ""
  return match[1].trim()
}

export function createStartPlanningHook(ctx: PluginInput) {
  return {
    "chat.message": async (input: StartPlanningHookInput, output: StartPlanningHookOutput): Promise<void> => {
      const parts = output.parts
      const promptText =
        parts
          ?.filter((p) => p.type === "text" && p.text)
          .map((p) => p.text)
          .join("\n")
          .trim() || ""

      if (!promptText.includes("<session-context>")) return
      if (!promptText.includes("<planning-intent>")) return

      log(`[${HOOK_NAME}] Processing start-planning command`, { sessionID: input.sessionID })
      updateSessionAgent(input.sessionID, "prometheus")

      const timestamp = new Date().toISOString()
      const userRequest = extractUserRequest(promptText)
      const draftsDir = join(ctx.directory, ".sisyphus", "drafts")
      mkdirSync(draftsDir, { recursive: true })

      const safeTs = timestamp.replace(/[:.]/g, "-")
      const draftPath = join(draftsDir, `start-planning-${safeTs}.md`)
      if (userRequest) {
        writeFileSync(
          draftPath,
          `# Start Planning Intake\n\n## Timestamp\n${timestamp}\n\n## Topic\n${userRequest}\n`,
          "utf-8",
        )
      }

      const contextInfo = `
## Start-Planning Handoff

**Target Agent**: Prometheus (Plan Builder)
**Session ID**: ${input.sessionID}
**Timestamp**: ${timestamp}
${userRequest ? `**Topic**: ${userRequest}` : "**Topic**: (none provided)"}
${userRequest ? `**Draft**: ${draftPath}` : "**Draft**: (not created)"}

Proceed with deep planning. Build a complete plan under .sisyphus/plans/.`

      const idx = output.parts.findIndex((p) => p.type === "text" && p.text)
      if (idx >= 0 && output.parts[idx].text) {
        output.parts[idx].text = output.parts[idx].text
          .replace(/\$SESSION_ID/g, input.sessionID)
          .replace(/\$TIMESTAMP/g, timestamp)

        output.parts[idx].text += `\n\n---\n${contextInfo}`
      }
    },
  }
}
