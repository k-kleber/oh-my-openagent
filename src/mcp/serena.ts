import type { McpName } from "./types"

export const serena = {
  type: "local" as const,
  command: [
    "serena",
    "start-mcp-server",
    "--context",
    "agent",
    "--enable-web-dashboard",
    "false",
    "--open-web-dashboard",
    "false",
  ],
  enabled: true,
}

export type SerenaConfig = typeof serena
