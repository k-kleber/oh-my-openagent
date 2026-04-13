const { describe, expect, mock, test } = require("bun:test")

mock.module("../../shared/opencode-message-dir", () => ({
  getMessageDir: () => null,
}))

mock.module("../../shared/opencode-storage-detection", () => ({
  isSqliteBackend: () => true,
}))

mock.module("../../shared/normalize-sdk-response", () => ({
  normalizeSDKResponse: <TData>(response: { data?: TData }, fallback: TData): TData => response.data ?? fallback,
}))

const { getLastAgentFromSession } = await import("./session-last-agent")

function createMockClient(messages: Array<{ id?: string; info?: { agent?: string; time?: { created?: number } } }>) {
  return {
    session: {
      messages: async () => ({ data: messages }),
    },
  }
}

describe("getLastAgentFromSession sqlite branch", () => {
  test("should skip compaction and return the previous real agent from sqlite messages", async () => {
    // given
    const client = createMockClient([
      { info: { agent: "atlas" } },
      { info: { agent: "compaction" } },
    ])

    // when
    const result = await getLastAgentFromSession("ses_sqlite_compaction", client)

    // then
    expect(result).toBe("atlas")
  })

  test("should return null when sqlite history contains only compaction", async () => {
    // given
    const client = createMockClient([{ info: { agent: "compaction" } }])

    // when
    const result = await getLastAgentFromSession("ses_sqlite_only_compaction", client)

    // then
    expect(result).toBeNull()
  })

  test("should prefer newest message by created timestamp instead of array order", async () => {
    // given
    const client = createMockClient([
      {
        id: "msg_older",
        info: { agent: "atlas", time: { created: 100 } },
      },
      {
        id: "msg_newer",
        info: { agent: "sisyphus", time: { created: 200 } },
      },
    ])

    // when
    const result = await getLastAgentFromSession("ses_sqlite_timestamp", client)

    // then
    expect(result).toBe("sisyphus")
  })
})

export {}
