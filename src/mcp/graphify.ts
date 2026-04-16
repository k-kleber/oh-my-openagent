import type { McpName } from "./types";

export const graphify = {
  type: "local" as const,
  command: ["uv", "run", "--with", "graphifyy[mcp]", "python", "-m", "graphify.serve"],
  args: ["graphify-out/graph.json"],
  enabled: true,
};

export type GraphifyConfig = typeof graphify;
