import { createWebsearchConfig } from "./websearch"
import { createContext7Config, context7 } from "./context7"
import { grep_app } from "./grep-app"
import { createGraphifyConfig, graphify } from "./graphify"
import { serena } from "./serena"
import type { OhMyOpenCodeConfig } from "../config/schema"

export { McpNameSchema, type McpName } from "./types"
export { context7, grep_app, graphify, serena }

type RemoteMcpConfig = {
  type: "remote"
  url: string
  enabled: boolean
  headers?: Record<string, string>
  oauth?: false
}

type LocalMcpConfig = {
  type: "local"
  command: string[]
  args?: string[]
  enabled: boolean
}

export function createBuiltinMcps(
  disabledMcps: string[] = [],
  config?: OhMyOpenCodeConfig,
  directory?: string,
) {
  const mcps: Record<string, RemoteMcpConfig | LocalMcpConfig> = {}

  if (!disabledMcps.includes("serena")) {
    mcps.serena = serena
  }

  if (!disabledMcps.includes("websearch")) {
    mcps.websearch = createWebsearchConfig(config?.websearch)
  }

  if (!disabledMcps.includes("context7")) {
    mcps.context7 = createContext7Config()
  }

  if (!disabledMcps.includes("grep_app")) {
    mcps.grep_app = grep_app
  }

  if (!disabledMcps.includes("graphify")) {
    mcps.graphify = createGraphifyConfig(directory)
  }

  return mcps
}
