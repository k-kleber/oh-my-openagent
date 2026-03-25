import { describe, expect, test, beforeEach, afterEach, spyOn } from "bun:test"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"
import { createStartPlanningHook } from "./index"
import * as sessionState from "../../features/claude-code-session-state"

describe("start-planning hook", () => {
  let testDir: string

  function createMockPluginInput() {
    return {
      directory: testDir,
      client: {},
    } as Parameters<typeof createStartPlanningHook>[0]
  }

  beforeEach(() => {
    testDir = join(tmpdir(), `start-planning-test-${randomUUID()}`)
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true })
    }
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  test("updates session agent to Prometheus", async () => {
    const updateSpy = spyOn(sessionState, "updateSessionAgent")

    const hook = createStartPlanningHook(createMockPluginInput())
    const output = {
      parts: [
        {
          type: "text",
          text: `<planning-intent>enabled</planning-intent>\n<session-context>Session ID: $SESSION_ID</session-context>\n<user-request>new strategy</user-request>`,
        },
      ],
    }

    await hook["chat.message"]({ sessionID: "ses-plan" }, output)

    expect(updateSpy).toHaveBeenCalledWith("ses-plan", "prometheus")
    updateSpy.mockRestore()
  })

  test("creates a .sisyphus planning draft when user-request is present", async () => {
    const hook = createStartPlanningHook(createMockPluginInput())
    const output = {
      parts: [
        {
          type: "text",
          text: `<planning-intent>enabled</planning-intent>\n<session-context>Session ID: $SESSION_ID</session-context>\n<user-request>idea: event-driven redesign</user-request>`,
        },
      ],
    }

    await hook["chat.message"]({ sessionID: "ses-plan-2" }, output)

    const draftsDir = join(testDir, ".sisyphus", "drafts")
    expect(existsSync(draftsDir)).toBe(true)
    const files = require("node:fs").readdirSync(draftsDir)
    expect(files.some((f: string) => f.startsWith("start-planning-") && f.endsWith(".md"))).toBe(true)
    const draftFile = files.find((f: string) => f.startsWith("start-planning-") && f.endsWith(".md"))
    const content = readFileSync(join(draftsDir, draftFile), "utf-8")
    expect(content).toContain("event-driven redesign")
  })
})
