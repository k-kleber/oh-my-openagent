import { describe, expect, it, mock } from "bun:test"
import { MemoryOrchestrator } from "./orchestrator"

mock.module("../../tools/glob/cli", () => ({
  runRgFiles: async () => ({ files: [{ path: "/repo/project/src/auth.ts", mtime: Date.now() }], totalFiles: 1, truncated: false }),
}))

mock.module("../../tools/grep/cli", () => ({
  runRg: async () => ({
    matches: [{ file: "/repo/project/src/auth.ts", line: 42, text: "recent debugging pattern" }],
    totalMatches: 1,
    filesSearched: 1,
    truncated: false,
  }),
}))

mock.module("../../tools/lsp/lsp-client-wrapper", () => ({
  withLspClient: async (_filePath: string, fn: (client: { documentSymbols: (filePath: string) => Promise<unknown> }) => Promise<unknown>) => {
    return await fn({
      documentSymbols: async () => ([{ name: "AuthService" }]),
    })
  },
}))

describe("memory orchestrator recall", () => {
  it("returns ranked recall items from hindsight and openmemory", async () => {
    const manager = {
      callTool: async (_info: unknown, _context: unknown, toolName: string) => {
        if (toolName === "recall") {
          return { results: [{ text: "AuthService recent debugging pattern" }] }
        }
        if (toolName === "openmemory_query") {
          return [{ text: "AuthService project workflow memory" }]
        }
        return []
      },
    } as never

    const orchestrator = new MemoryOrchestrator(manager)
    const result = await orchestrator.recall({
      sessionID: "ses-1",
      projectPath: "/repo/project",
      projectName: "project",
      query: "debug auth",
      scope: "project",
      agentName: "sisyphus",
      recentTools: ["grep", "read"],
    })

    expect(result.hits).toBeGreaterThan(0)
    expect(result.items[0]?.verification).toBe("verified")
    expect(result.items[0]?.evidence?.path).toContain("auth.ts")
  })

  it("uses memory-mcp skill identity for managed clients", async () => {
    const calls: Array<{ info: unknown; context: unknown; toolName: string }> = []
    const manager = {
      callTool: async (info: unknown, context: unknown, toolName: string) => {
        calls.push({ info, context, toolName })
        if (toolName === "recall") return []
        if (toolName === "openmemory_query") return { results: [] }
        return []
      },
    } as never

    const orchestrator = new MemoryOrchestrator(manager)
    await orchestrator.recall({
      sessionID: "ses-2",
      projectPath: "/repo/project",
      projectName: "project",
      query: "memory setup",
      scope: "project",
    })

    expect(calls[0]?.info).toMatchObject({ skillName: "memory-mcp", serverName: "hindsight" })
    expect(calls[0]?.context).toMatchObject({ skillName: "memory-mcp" })
    expect(calls[1]?.info).toMatchObject({ skillName: "memory-mcp", serverName: "openmemory" })
    expect(calls[1]?.context).toMatchObject({ skillName: "memory-mcp" })
  })
})
