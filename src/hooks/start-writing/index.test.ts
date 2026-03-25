import { describe, expect, test, beforeEach, afterEach, spyOn } from "bun:test"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"
import { createStartWritingHook } from "./index"
import * as sessionState from "../../features/claude-code-session-state"

describe("start-writing hook", () => {
  let testDir: string

  function createMockPluginInput() {
    return {
      directory: testDir,
      client: {},
    } as Parameters<typeof createStartWritingHook>[0]
  }

  beforeEach(() => {
    testDir = join(tmpdir(), `start-writing-test-${randomUUID()}`)
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true })
    }
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  test("updates session agent to writer", async () => {
    const updateSpy = spyOn(sessionState, "updateSessionAgent")

    const hook = createStartWritingHook(createMockPluginInput())
    const output = {
      parts: [
        {
          type: "text",
          text: `<writing-intent>enabled</writing-intent>\n<session-context>Session ID: $SESSION_ID</session-context>\n<user-request>blog post intro</user-request>`,
        },
      ],
    }

    await hook["chat.message"]({ sessionID: "ses-write" }, output)

    expect(updateSpy).toHaveBeenCalledWith("ses-write", "writer")
    updateSpy.mockRestore()
  })

  test("creates a .sisyphus writing draft when user-request is present", async () => {
    const hook = createStartWritingHook(createMockPluginInput())
    const output = {
      parts: [
        {
          type: "text",
          text: `<writing-intent>enabled</writing-intent>\n<session-context>Session ID: $SESSION_ID</session-context>\n<user-request>audience: CTO, topic: migration strategy</user-request>`,
        },
      ],
    }

    await hook["chat.message"]({ sessionID: "ses-write-2" }, output)

    const draftsDir = join(testDir, ".sisyphus", "drafts")
    expect(existsSync(draftsDir)).toBe(true)
    const files = require("node:fs").readdirSync(draftsDir)
    expect(files.some((f: string) => f.startsWith("start-writing-") && f.endsWith(".md"))).toBe(true)
    const draftFile = files.find((f: string) => f.startsWith("start-writing-") && f.endsWith(".md"))
    const content = readFileSync(join(draftsDir, draftFile), "utf-8")
    expect(content).toContain("migration strategy")
  })
})
