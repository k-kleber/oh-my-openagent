import { createWebsearchConfig } from "./websearch"
import { context7 } from "./context7"
import { grep_app } from "./grep-app"
import { hindsight } from "./hindsight"
import { openmemory } from "./openmemory"
import { serena } from "./serena"
import type { OhMyOpenCodeConfig } from "../config/schema"

export { McpNameSchema, type McpName } from "./types"
export { context7, grep_app, hindsight, openmemory, serena }

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
  enabled: boolean
}

export function createBuiltinMcps(disabledMcps: string[] = [], config?: OhMyOpenCodeConfig) {
  const mcps: Record<string, RemoteMcpConfig | LocalMcpConfig> = {}

  if (!disabledMcps.includes("serena")) {
    mcps.serena = serena
  }

  if (!disabledMcps.includes("websearch")) {
    mcps.websearch = createWebsearchConfig(config?.websearch)
  }

  if (!disabledMcps.includes("context7")) {
    mcps.context7 = context7
  }

  if (!disabledMcps.includes("grep_app")) {
    mcps.grep_app = grep_app
  }

  if (!disabledMcps.includes("hindsight")) {
    mcps.hindsight = hindsight
  }

  if (!disabledMcps.includes("openmemory")) {
    mcps.openmemory = openmemory
  }

  return mcps
}
