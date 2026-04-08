import type { WebsearchConfig } from "../config/schema"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

type RemoteMcpConfig = {
  type: "remote"
  url: string
  enabled: boolean
  headers?: Record<string, string>
  oauth?: false
}

function parseKeyFromEnvFile(filePath: string, keyName: string): string | undefined {
  if (!existsSync(filePath)) return undefined
  const content = readFileSync(filePath, "utf-8")
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      ?? trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
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
  const candidates = [
    join(cwd, ".secrets"),
    join(cwd, ".env"),
  ]

  for (const filePath of candidates) {
    const found = parseKeyFromEnvFile(filePath, keyName)?.trim()
    if (found) return found
  }

  return undefined
}

function getTavilyAuthorizationHeader(): string | undefined {
  const tavilyKey = getEnvOrSecretsValue("TAVILY_API_KEY")
  if (!tavilyKey) return undefined
  return tavilyKey.startsWith("Bearer ") ? tavilyKey : `Bearer ${tavilyKey}`
}

export function createWebsearchConfig(config?: WebsearchConfig): RemoteMcpConfig {
  const explicitProvider = config?.provider
  const tavilyAuthorization = getTavilyAuthorizationHeader()
  const provider = explicitProvider ?? (tavilyAuthorization ? "tavily" : "exa")

  if (provider === "tavily") {
    if (!tavilyAuthorization) {
      throw new Error("TAVILY_API_KEY environment variable is required for Tavily provider")
    }

    return {
      type: "remote" as const,
      url: "https://mcp.tavily.com/mcp/",
      enabled: true,
      headers: {
        Authorization: tavilyAuthorization,
      },
      oauth: false as const,
    }
  }

  // Default to Exa
  const exaApiKey = getEnvOrSecretsValue("EXA_API_KEY")
  return {
    type: "remote" as const,
    url: exaApiKey
      ? `https://mcp.exa.ai/mcp?tools=web_search_exa&exaApiKey=${encodeURIComponent(exaApiKey)}`
      : "https://mcp.exa.ai/mcp?tools=web_search_exa",
    enabled: true,
    ...(exaApiKey ? { headers: { "x-api-key": exaApiKey } } : {}),
    oauth: false as const,
  }
}

// Backward compatibility: export static instance using default config
export const websearch = createWebsearchConfig()
