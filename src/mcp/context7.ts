import { getEnvOrSecretsValue } from "../shared/env-or-secrets"

type RemoteMcpConfig = {
  type: "remote"
  url: string
  enabled: boolean
  headers?: Record<string, string>
  oauth?: false
}

export function createContext7Config(): RemoteMcpConfig {
  const context7ApiKey = getEnvOrSecretsValue("CONTEXT7_API_KEY")

  return {
    type: "remote" as const,
    url: "https://mcp.context7.com/mcp",
    enabled: true,
    headers: context7ApiKey
      ? { Authorization: `Bearer ${context7ApiKey}` }
      : undefined,
    // Disable OAuth auto-detection - Context7 uses API key header, not OAuth
    oauth: false as const,
  }
}

export const context7 = createContext7Config()
