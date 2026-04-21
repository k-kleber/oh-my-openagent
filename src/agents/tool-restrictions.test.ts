import { describe, test, expect } from "bun:test"
import { createOracleAgent } from "./oracle"
import { createLibrarianAgent } from "./librarian"
import { createExploreAgent } from "./explore"
import { createMomusAgent } from "./momus"
import { createMetisAgent } from "./metis"
import { createTesterAgent } from "./tester"
import { createAtlasAgent } from "./atlas"
import { createDeepExplorerAgent } from "./deep-explorer"
import { createDebuggerAgent } from "./debugger"

const TEST_MODEL = "anthropic/claude-sonnet-4-5"

describe("read-only agent tool restrictions", () => {
  const FILE_WRITE_TOOLS = ["write", "edit", "apply_patch"]

  describe("Oracle", () => {
    test("denies all file-writing tools", () => {
      // given
      const agent = createOracleAgent(TEST_MODEL)

      // when
      const permission = agent.permission as Record<string, string>

      // then
      for (const tool of FILE_WRITE_TOOLS) {
        expect(permission[tool]).toBe("deny")
      }
    })

    test("denies task but allows call_omo_agent for research", () => {
      // given
      const agent = createOracleAgent(TEST_MODEL)

      // when
      const permission = agent.permission as Record<string, string>

      // then
      expect(permission["task"]).toBe("deny")
      expect(permission["call_omo_agent"]).toBeUndefined()
    })
  })

  describe("Librarian", () => {
    test("denies all file-writing tools", () => {
      // given
      const agent = createLibrarianAgent(TEST_MODEL)

      // when
      const permission = agent.permission as Record<string, string>

      // then
      for (const tool of FILE_WRITE_TOOLS) {
        expect(permission[tool]).toBe("deny")
      }
    })
  })

  describe("Explore", () => {
    test("denies all file-writing tools", () => {
      // given
      const agent = createExploreAgent(TEST_MODEL)

      // when
      const permission = agent.permission as Record<string, string>

      // then
      for (const tool of FILE_WRITE_TOOLS) {
        expect(permission[tool]).toBe("deny")
      }
    })

    test("includes tool call format guardrails in prompt", () => {
      const agent = createExploreAgent(TEST_MODEL)

      expect(agent.prompt).toContain("Tool Call Format (CRITICAL)")
      expect(agent.prompt).toContain("NEVER output tool calls as text")
    })
  })

  describe("Deep Explorer", () => {
    test("includes tool call format guardrails in prompt", () => {
      const agent = createDeepExplorerAgent(TEST_MODEL)

      expect(agent.prompt).toContain("Tool Call Format (CRITICAL)")
      expect(agent.prompt).toContain("NEVER output tool calls as text")
    })
  })

  describe("Debugger", () => {
    test("includes tool call format guardrails in prompt", () => {
      const agent = createDebuggerAgent(TEST_MODEL)

      expect(agent.prompt).toContain("Tool Call Format (CRITICAL)")
      expect(agent.prompt).toContain("NEVER output tool calls as text")
    })
  })

  describe("Momus", () => {
    test("denies all file-writing tools", () => {
      // given
      const agent = createMomusAgent(TEST_MODEL)

      // when
      const permission = agent.permission as Record<string, string>

      // then
      for (const tool of FILE_WRITE_TOOLS) {
        expect(permission[tool]).toBe("deny")
      }
    })
  })

  describe("Metis", () => {
    test("denies all file-writing tools", () => {
      // given
      const agent = createMetisAgent(TEST_MODEL)

      // when
      const permission = agent.permission as Record<string, string>

      // then
      for (const tool of FILE_WRITE_TOOLS) {
        expect(permission[tool]).toBe("deny")
      }
    })
  })

  describe("Atlas", () => {
    test("allows delegation tools for orchestration", () => {
      // given
      const agent = createAtlasAgent({ model: TEST_MODEL })

      // when
      const permission = (agent.permission ?? {}) as Record<string, string>

      // then
      expect(permission["task"]).toBeUndefined()
      expect(permission["call_omo_agent"]).toBeUndefined()
    })
  })

  describe("Tester", () => {
    test("allows only bash through wildcard-deny permission", () => {
      const agent = createTesterAgent(TEST_MODEL)
      const permission = (agent.permission ?? {}) as Record<string, unknown>
      const bashPermission = permission["bash"] as Record<string, string>

      expect(permission["*"]).toBe("deny")
      expect(bashPermission).toEqual(expect.objectContaining({
        bun: "allow",
        npm: "allow",
        pytest: "allow",
        "*pytest*": "allow",
        ruff: "allow",
        "*ruff check*": "allow",
        pyright: "allow",
        "*pyright*": "allow",
        cargo: "allow",
        ctest: "allow",
        "*ctest*": "allow",
        bazel: "allow",
        catkin: "allow",
        catkin_make: "allow",
        rostest: "allow",
        source: "allow",
        timeout: "allow",
        env: "allow",
      }))
      expect(bashPermission.git).toBe("deny")
      expect(bashPermission.rm).toBe("deny")
    })
  })
})
