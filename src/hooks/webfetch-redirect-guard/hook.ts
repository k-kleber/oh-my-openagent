import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared"
import {
  MAX_WEBFETCH_REDIRECTS,
  WEBFETCH_REDIRECT_ERROR_PATTERNS,
  WEBFETCH_REDIRECT_GUARD_STALE_TIMEOUT_MS,
} from "./constants"
import {
  resolveWebFetchRedirects,
  type WebFetchFormat,
} from "./redirect-resolution"

type ToolExecuteInput = { tool: string; sessionID: string; callID: string }
type ToolExecuteBeforeOutput = { args: Record<string, unknown> }
type ToolExecuteAfterOutput = {
  title: string
  output: string
  metadata: Record<string, unknown>
}

type PendingRedirectFailure = {
  originalUrl: string
  storedAt: number
}

type RecentWebFetchRequest = {
  url: string
  storedAt: number
}

const WEBFETCH_RECOVERY_MARKER = "[webfetch-recovery]"

function makeKey(sessionID: string, callID: string): string {
  return `${sessionID}:${callID}`
}

function isWebFetchTool(toolName: string): boolean {
  return toolName.toLowerCase() === "webfetch"
}

function getWebFetchUrl(args: Record<string, unknown>): string | undefined {
  return typeof args.url === "string" && args.url.length > 0 ? args.url : undefined
}

function getWebFetchFormat(args: Record<string, unknown>): WebFetchFormat {
  return args.format === "text" || args.format === "html" ? args.format : "markdown"
}

function getTimeoutSeconds(args: Record<string, unknown>): number | undefined {
  return typeof args.timeout === "number" && Number.isFinite(args.timeout) ? args.timeout : undefined
}

function cleanupStaleEntries(pendingFailures: Map<string, PendingRedirectFailure>): void {
  const now = Date.now()
  for (const [key, value] of pendingFailures) {
    if (now - value.storedAt > WEBFETCH_REDIRECT_GUARD_STALE_TIMEOUT_MS) {
      pendingFailures.delete(key)
    }
  }
}

function cleanupStaleRequests(recentRequests: Map<string, RecentWebFetchRequest>): void {
  const now = Date.now()
  for (const [key, value] of recentRequests) {
    if (now - value.storedAt > WEBFETCH_REDIRECT_GUARD_STALE_TIMEOUT_MS) {
      recentRequests.delete(key)
    }
  }
}

function extractStatusCode(output: string): number | null {
  const match = output.match(/status code:\s*(\d{3})/i)
  if (!match?.[1]) return null
  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : null
}

function buildGithubRecovery(url: string): string {
  return `${WEBFETCH_RECOVERY_MARKER} GitHub fetch failed for ${url}\n`
    + `- Verify file existence first: gh api repos/{owner}/{repo}/contents/{path}?ref={ref}\n`
    + `- If using /blob/ URL, avoid guessed raw URLs; resolve via contents API download_url\n`
    + `- If commit SHA may be stale, refresh ref and rediscover the file path via gh search code`
}

function buildReadTheDocsRecovery(url: string): string {
  return `${WEBFETCH_RECOVERY_MARKER} ReadTheDocs fetch failed for ${url}\n`
    + `- Discover canonical page from sitemap first: /sitemap.xml\n`
    + `- Retry canonical variants: /en/latest/ and /en/stable/\n`
    + `- If repeated failures persist, check https://status.readthedocs.org/`
}

function buildTransientRecovery(url: string | undefined, statusCode: number): string {
  const suffix = url ? ` for ${url}` : ""
  return `${WEBFETCH_RECOVERY_MARKER} transient HTTP ${statusCode}${suffix}\n`
    + `- Retry with exponential backoff + jitter\n`
    + `- Respect Retry-After header when present\n`
    + `- If source is unstable, continue with alternate source instead of blocking`
}

function buildRecoveryAdvice(url: string | undefined, statusCode: number): string | null {
  if (statusCode >= 500) {
    return buildTransientRecovery(url, statusCode)
  }

  if (!url || statusCode !== 404) return null

  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes("github.com/") || lowerUrl.includes("raw.githubusercontent.com/")) {
    return buildGithubRecovery(url)
  }
  if (lowerUrl.includes("readthedocs.io/")) {
    return buildReadTheDocsRecovery(url)
  }

  return null
}

function isRedirectLoopError(output: string): boolean {
  return WEBFETCH_REDIRECT_ERROR_PATTERNS.some((pattern) => pattern.test(output))
}

function isToolErrorOutput(output: string): boolean {
  return output.trimStart().toLowerCase().startsWith("error:")
}

function isHttpFailureOutput(output: string): boolean {
  const normalized = output.trimStart().toLowerCase()
  return normalized.includes("request failed with status code") || normalized.includes("streamable http error")
}

function buildRedirectLimitMessage(url?: string): string {
  const suffix = url ? ` for ${url}` : ""
  return `Error: WebFetch failed: exceeded maximum redirects (${MAX_WEBFETCH_REDIRECTS})${suffix}`
}

export function createWebFetchRedirectGuardHook(_ctx: PluginInput) {
  const pendingFailures = new Map<string, PendingRedirectFailure>()
  const recentRequests = new Map<string, RecentWebFetchRequest>()

  return {
    "tool.execute.before": async (input: ToolExecuteInput, output: ToolExecuteBeforeOutput) => {
      if (!isWebFetchTool(input.tool)) return

      const url = getWebFetchUrl(output.args)
      if (!url) return

      cleanupStaleEntries(pendingFailures)
      cleanupStaleRequests(recentRequests)

      recentRequests.set(makeKey(input.sessionID, input.callID), {
        url,
        storedAt: Date.now(),
      })

      try {
        const resolution = await resolveWebFetchRedirects({
          url,
          format: getWebFetchFormat(output.args),
          timeoutSeconds: getTimeoutSeconds(output.args),
        })

        if (resolution.type === "resolved") {
          output.args.url = resolution.url
          return
        }

        pendingFailures.set(makeKey(input.sessionID, input.callID), {
          originalUrl: url,
          storedAt: Date.now(),
        })
      } catch (error) {
        log("[webfetch-redirect-guard] Failed to pre-resolve redirects", {
          sessionID: input.sessionID,
          callID: input.callID,
          url,
          error,
        })
      }
    },

    "tool.execute.after": async (input: ToolExecuteInput, output: ToolExecuteAfterOutput) => {
      if (!isWebFetchTool(input.tool)) return
      if (typeof output.output !== "string") return

      const key = makeKey(input.sessionID, input.callID)
      const pendingFailure = pendingFailures.get(key)
      const recentRequest = recentRequests.get(key)
      recentRequests.delete(key)
      if (pendingFailure) {
        pendingFailures.delete(key)
        output.output = buildRedirectLimitMessage(pendingFailure.originalUrl)
        return
      }

      if (isToolErrorOutput(output.output) && isRedirectLoopError(output.output)) {
        output.output = buildRedirectLimitMessage()
        return
      }

      if (output.output.includes(WEBFETCH_RECOVERY_MARKER)) {
        return
      }

      if (!isToolErrorOutput(output.output) && !isHttpFailureOutput(output.output)) {
        return
      }

      const statusCode = extractStatusCode(output.output)
      if (!statusCode) return

      const recoveryAdvice = buildRecoveryAdvice(recentRequest?.url, statusCode)
      if (!recoveryAdvice) return

      output.output = `${output.output}\n${recoveryAdvice}`
      log("[webfetch-redirect-guard] Added recovery advice for failed WebFetch", {
        sessionID: input.sessionID,
        callID: input.callID,
        statusCode,
        url: recentRequest?.url,
      })
    },
  }
}
