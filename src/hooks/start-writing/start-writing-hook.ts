import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { PluginInput } from "@opencode-ai/plugin"
import { updateSessionAgent } from "../../features/claude-code-session-state"
import { log } from "../../shared/logger"

export const HOOK_NAME = "start-writing" as const

interface StartWritingHookInput {
  sessionID: string
  messageID?: string
}

interface StartWritingHookOutput {
  parts: Array<{ type: string; text?: string }>
}

function extractUserRequest(promptText: string): string {
  const match = promptText.match(/<user-request>\s*([\s\S]*?)\s*<\/user-request>/i)
  if (!match) return ""
  return match[1].trim()
}

export function createStartWritingHook(ctx: PluginInput) {
  return {
    "chat.message": async (input: StartWritingHookInput, output: StartWritingHookOutput): Promise<void> => {
      const parts = output.parts
      const promptText =
        parts
          ?.filter((p) => p.type === "text" && p.text)
          .map((p) => p.text)
          .join("\n")
          .trim() || ""

      if (!promptText.includes("<session-context>")) return
      if (!promptText.includes("<writing-intent>")) return

      log(`[${HOOK_NAME}] Processing start-writing command`, { sessionID: input.sessionID })
      updateSessionAgent(input.sessionID, "writer")

      const timestamp = new Date().toISOString()
      const userRequest = extractUserRequest(promptText)
      const draftsDir = join(ctx.directory, ".sisyphus", "drafts")
      mkdirSync(draftsDir, { recursive: true })

      const safeTs = timestamp.replace(/[:.]/g, "-")
      const draftPath = join(draftsDir, `start-writing-${safeTs}.md`)
      if (userRequest) {
        writeFileSync(
          draftPath,
          `# Start Writing Intake\n\n## Timestamp\n${timestamp}\n\n## Topic or Brief\n${userRequest}\n`,
          "utf-8",
        )
      }

      const contextInfo = `
## Start-Writing Handoff

**Target Agent**: Writer (Content Partner)
**Session ID**: ${input.sessionID}
**Timestamp**: ${timestamp}
${userRequest ? `**Topic/Brief**: ${userRequest}` : "**Topic/Brief**: (none provided)"}
${userRequest ? `**Draft**: ${draftPath}` : "**Draft**: (not created)"}

Before drafting, run conversational intake with the user:
- audience
- objective
- tone/voice
- format and length
- constraints and must-include points`

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
