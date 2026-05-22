import { join } from "node:path"
import type { McpName } from "./types"

export function createGraphifyConfig(directory?: string) {
  return {
    type: "local" as const,
    command: ["uv", "run", "--with", "graphifyy[mcp]", "python", "-m", "graphify.serve"],
    args: [directory ? join(directory, "graphify-out", "graph.json") : "graphify-out/graph.json"],
    enabled: true,
  }
}

export const graphify = createGraphifyConfig()

export type GraphifyConfig = ReturnType<typeof createGraphifyConfig>
