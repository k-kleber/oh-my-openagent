import type { McpName } from "./types";

export const serena = {
  type: "local" as const,
  command: [
    "uvx",
    "--from",
    "git+https://github.com/oraios/serena",
    "serena",
    "start-mcp-server",
    "--context",
    "claude-code",
    "--mode",
    "editing",
    "--enable-web-dashboard",
    "false",
    "--open-web-dashboard",
    "false",
  ],
  enabled: true,
};

export type SerenaConfig = typeof serena;
