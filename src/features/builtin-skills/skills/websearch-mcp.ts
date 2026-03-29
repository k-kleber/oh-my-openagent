import type { BuiltinSkill } from "../types"
import type { WebsearchConfig } from "../../../config/schema"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { getOpenCodeConfigDir } from "../../../shared/opencode-config-dir"

function parseKeyFromEnvFile(filePath: string, keyName: string): string | undefined {
  if (!existsSync(filePath)) return undefined
  const content = readFileSync(filePath, "utf-8")
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/) ?? trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    const [, name, rawValue] = match
    if (name !== keyName) continue
    const value = rawValue.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1")
    return value || undefined
  }
  return undefined
}

function getEnvOrSecretsValue(keyName: string): string | undefined {
  const direct = process.env[keyName]?.trim()
  if (direct) return direct

  const cwd = process.cwd()
  const opencodeDir = getOpenCodeConfigDir({ binary: "opencode" })
  const candidates = [
    join(cwd, ".secrets"),
    join(cwd, ".env"),
    join(opencodeDir, ".secrets"),
    join(opencodeDir, ".env"),
    join(homedir(), ".secrets"),
    join(homedir(), ".env"),
  ]

  for (const filePath of candidates) {
    const found = parseKeyFromEnvFile(filePath, keyName)?.trim()
    if (found) return found
  }

  return undefined
}

function getTavilyAuthHeaders(): Record<string, string> | undefined {
  const key = getEnvOrSecretsValue("TAVILY_API_KEY")
  if (!key) return undefined

  const trimmed = key.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith("Bearer ")) {
    return { Authorization: trimmed }
  }

  return { Authorization: `Bearer ${trimmed}` }
}

export function createWebsearchMcpSkill(config?: WebsearchConfig): BuiltinSkill {
  const provider = config?.provider ?? "exa"
  const isTavily = provider === "tavily"
  const preferredToolName = isTavily ? "tavily_search" : "web_search_exa"
  const alternateToolHint = isTavily
    ? "If tool discovery differs in your MCP version, run tool listing first and use the exact Tavily search tool name shown."
    : "If tool discovery differs in your MCP version, run tool listing first and use the exact Exa search tool name shown."
  const tavilyHeaders: Record<string, string> | undefined = getTavilyAuthHeaders()
  const exaHeaders: Record<string, string> | undefined = process.env.EXA_API_KEY
    ? { "x-api-key": process.env.EXA_API_KEY }
    : undefined

  const mcpConfig = isTavily
      ? {
          websearch: {
            type: "http" as const,
            url: "https://mcp.tavily.com/mcp/",
            ...(tavilyHeaders ? { headers: tavilyHeaders } : {}),
          },
        }
      : {
          websearch: {
            type: "http" as const,
            url: process.env.EXA_API_KEY
              ? `https://mcp.exa.ai/mcp?tools=web_search_exa&exaApiKey=${encodeURIComponent(process.env.EXA_API_KEY)}`
              : "https://mcp.exa.ai/mcp?tools=web_search_exa",
            ...(exaHeaders ? { headers: exaHeaders } : {}),
          },
        }

  return {
    name: "websearch-mcp",
    description:
      "On-demand websearch MCP access for external information lookup (Exa/Tavily) without always-on MCP mounting.",
    template: `# Websearch MCP (On-Demand)

Use this skill when you need external web information and citations.

## When to use

- User asks for current facts or external references
- You need docs/articles not present in local code
- You need quick market/news/context checks

## Preferred tool call

- Preferred tool name: \`${preferredToolName}\`
- Keep queries specific and source-oriented
- ${alternateToolHint}

## Active provider

- ${provider}

## Guardrails

- Prefer local/repo evidence first when possible
- Limit web fanout for simple questions
- Cite sources when claims depend on web content`,
    mcpConfig,
  }
}
