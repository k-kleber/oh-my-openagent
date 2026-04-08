import { describe, expect, test } from "bun:test"

import { createSyncSession } from "./sync-session-creator"
import { TESTER_SESSION_PERMISSION } from "../../shared/tester-session-permission"

describe("createSyncSession", () => {
  test("creates child session with question permission denied", async () => {
    // given
    const createCalls: Array<Record<string, unknown>> = []
    const client = {
      session: {
        get: async () => ({ data: { directory: "/parent" } }),
        create: async (input: Record<string, unknown>) => {
          createCalls.push(input)
          return { data: { id: "ses_child" } }
        },
      },
    }

    // when
    const result = await createSyncSession(client as never, {
      parentSessionID: "ses_parent",
      agentToUse: "explore",
      description: "test task",
      defaultDirectory: "/fallback",
    })

    // then
    expect(result).toEqual({ ok: true, sessionID: "ses_child", parentDirectory: "/parent" })
    expect(createCalls).toHaveLength(1)
    expect(createCalls[0]?.body).toEqual({
      parentID: "ses_parent",
      title: "test task (@explore subagent)",
      permission: [
        { permission: "question", action: "deny", pattern: "*" },
      ],
    })
  })

  test("creates tester child session with tester session permission", async () => {
    const createCalls: Array<Record<string, unknown>> = []
    const client = {
      session: {
        get: async () => ({ data: { directory: "/parent" } }),
        create: async (input: Record<string, unknown>) => {
          createCalls.push(input)
          return { data: { id: "ses_tester_child" } }
        },
      },
    }

    const result = await createSyncSession(client as never, {
      parentSessionID: "ses_parent",
      agentToUse: "tester",
      description: "tester task",
      defaultDirectory: "/fallback",
    })

    expect(result).toEqual({ ok: true, sessionID: "ses_tester_child", parentDirectory: "/parent" })
    expect(createCalls).toHaveLength(1)
    expect(createCalls[0]?.body).toEqual({
      parentID: "ses_parent",
      title: "tester task (@tester subagent)",
      permission: TESTER_SESSION_PERMISSION,
    })
  })
})
