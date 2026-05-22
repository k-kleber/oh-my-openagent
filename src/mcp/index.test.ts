import { describe, expect, test } from "bun:test"
import { createBuiltinMcps } from "./index"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

describe("createBuiltinMcps", () => {
  test("should return all MCPs when disabled_mcps is empty", () => {
    // given
    const disabledMcps: string[] = []

    // when
    const result = createBuiltinMcps(disabledMcps)

    // then
    expect(result).toHaveProperty("websearch")
    expect(result).toHaveProperty("context7")
    expect(result).toHaveProperty("grep_app")
    expect(result).toHaveProperty("serena")
    expect(result).toHaveProperty("graphify")
    expect(Object.keys(result)).toHaveLength(5)
  })

  test("should filter out disabled built-in MCPs", () => {
    // given
    const disabledMcps = ["context7"]

    // when
    const result = createBuiltinMcps(disabledMcps)

    // then
    expect(result).toHaveProperty("websearch")
    expect(result).not.toHaveProperty("context7")
    expect(result).toHaveProperty("grep_app")
    expect(result).toHaveProperty("serena")
    expect(result).toHaveProperty("graphify")
    expect(Object.keys(result)).toHaveLength(4)
  })

  test("should filter out all built-in MCPs when all disabled", () => {
    // given
    const disabledMcps = ["websearch", "context7", "grep_app", "serena", "graphify"]

    // when
    const result = createBuiltinMcps(disabledMcps)

    // then
    expect(result).not.toHaveProperty("websearch")
    expect(result).not.toHaveProperty("context7")
    expect(result).not.toHaveProperty("grep_app")
    expect(result).not.toHaveProperty("serena")
    expect(result).not.toHaveProperty("graphify")
    expect(Object.keys(result)).toHaveLength(0)
  })

  test("should ignore custom MCP names in disabled_mcps", () => {
    // given
    const disabledMcps = ["context7", "playwright", "custom"]

    // when
    const result = createBuiltinMcps(disabledMcps)

    // then
    expect(result).toHaveProperty("websearch")
    expect(result).not.toHaveProperty("context7")
    expect(result).toHaveProperty("grep_app")
    expect(result).toHaveProperty("serena")
    expect(result).toHaveProperty("graphify")
    expect(Object.keys(result)).toHaveLength(4)
  })

  test("should handle empty disabled_mcps by default", () => {
    // given
    // when
    const result = createBuiltinMcps()

    // then
    expect(result).toHaveProperty("websearch")
    expect(result).toHaveProperty("context7")
    expect(result).toHaveProperty("grep_app")
    expect(result).toHaveProperty("serena")
    expect(result).toHaveProperty("graphify")
    expect(Object.keys(result)).toHaveLength(5)
  })

  test("should only filter built-in MCPs, ignoring unknown names", () => {
    // given
    const disabledMcps = ["playwright", "sqlite", "unknown-mcp"]

    // when
    const result = createBuiltinMcps(disabledMcps)

    // then
    expect(result).toHaveProperty("websearch")
    expect(result).toHaveProperty("context7")
    expect(result).toHaveProperty("grep_app")
    expect(result).toHaveProperty("serena")
    expect(result).toHaveProperty("graphify")
    expect(Object.keys(result)).toHaveLength(5)
  })

  test("should not throw when websearch disabled even if tavily configured without API key", () => {
    // given
    const originalTavilyKey = process.env.TAVILY_API_KEY
    delete process.env.TAVILY_API_KEY
    const disabledMcps = ["websearch"]
    const config = { websearch: { provider: "tavily" as const } }

    try {
      // when
      const createMcps = () => createBuiltinMcps(disabledMcps, config)

      // then
      expect(createMcps).not.toThrow()
      const result = createMcps()
      expect(result).not.toHaveProperty("websearch")
    } finally {
      if (originalTavilyKey) process.env.TAVILY_API_KEY = originalTavilyKey
    }
  })

  test("reads CONTEXT7_API_KEY from project .secrets when env is absent", () => {
    const originalContext7Key = process.env.CONTEXT7_API_KEY
    const dir = mkdtempSync(join(tmpdir(), "omo-context7-config-"))
    const previousCwd = process.cwd()
    delete process.env.CONTEXT7_API_KEY
    writeFileSync(join(dir, ".secrets"), "CONTEXT7_API_KEY=test-context7-key\n")

    process.chdir(dir)
    try {
      const result = createBuiltinMcps()

      expect(result.context7).toBeDefined()
      expect(result.context7).toHaveProperty("headers")
      expect((result.context7 as { headers?: Record<string, string> }).headers).toEqual({
        Authorization: "Bearer test-context7-key",
      })
    } finally {
      process.chdir(previousCwd)
      rmSync(dir, { recursive: true, force: true })
      if (originalContext7Key === undefined) {
        delete process.env.CONTEXT7_API_KEY
      } else {
        process.env.CONTEXT7_API_KEY = originalContext7Key
      }
    }
  })

  test("uses an absolute project-local graphify path when directory is provided", () => {
    const result = createBuiltinMcps([], undefined, "/repo/project")

    expect(result.graphify).toEqual({
      type: "local",
      command: ["uv", "run", "--with", "graphifyy[mcp]", "python", "-m", "graphify.serve"],
      args: ["/repo/project/graphify-out/graph.json"],
      enabled: true,
    })
  })

  test("keeps the relative graphify path when directory is absent", () => {
    const result = createBuiltinMcps()

    expect(result.graphify).toEqual({
      type: "local",
      command: ["uv", "run", "--with", "graphifyy[mcp]", "python", "-m", "graphify.serve"],
      args: ["graphify-out/graph.json"],
      enabled: true,
    })
  })
})
