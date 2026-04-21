import { describe, expect, test } from "bun:test"

import { createChatHeadersHandler } from "./chat-headers"

function makeMockClient(existingMessageCount = 0) {
  const msgs = Array.from({ length: existingMessageCount }, (_, i) => ({ id: `msg_${i}` }))
  return {
    client: {
      session: {
        messages: async () => ({ data: msgs }),
      },
    },
  }
}

describe("createChatHeadersHandler", () => {
  test("first message in session: x-initiator: user (billing handshake)", async () => {
    const mock = makeMockClient(0)
    const handler = createChatHeadersHandler({ ctx: mock as never })
    const output: { headers: Record<string, string> } = { headers: {} }

    await handler(
      {
        sessionID: "ses_first",
        provider: { id: "github-copilot" },
        message: { id: "msg_first", role: "user" },
      },
      output,
    )

    expect(output.headers["x-initiator"]).toBe("user")
  })

  test("second message in same session: x-initiator: agent (no billing)", async () => {
    const mock = makeMockClient(0)
    const handler = createChatHeadersHandler({ ctx: mock as never })
    const output1: { headers: Record<string, string> } = { headers: {} }
    const output2: { headers: Record<string, string> } = { headers: {} }

    // First call: billedSessionSet is empty, session.messages() returns 0 → first billing
    await handler(
      {
        sessionID: "ses_second",
        provider: { id: "github-copilot" },
        message: { id: "msg_s2_1", role: "user" },
      },
      output1,
    )
    // Second call: billedSessionSet has session, session.messages() still 0
    // → alreadyBilled=true, existingCount=0 → NOT first → agent
    await handler(
      {
        sessionID: "ses_second",
        provider: { id: "github-copilot" },
        message: { id: "msg_s2_2", role: "user" },
      },
      output2,
    )

    expect(output1.headers["x-initiator"]).toBe("user")
    expect(output2.headers["x-initiator"]).toBe("agent")
    expect(output2.headers["x-copilot-is-agent"]).toBe("true")
    expect(output2.headers["openai-is-agent"]).toBe("true")
  })

  test("does not set headers for non-copilot providers", async () => {
    const mock = makeMockClient(0)
    const handler = createChatHeadersHandler({ ctx: mock as never })
    const output: { headers: Record<string, string> } = { headers: {} }

    await handler(
      {
        sessionID: "ses_ignore",
        provider: { id: "openai" },
        message: { id: "msg_ignore", role: "user" },
      },
      output,
    )

    expect(output.headers["x-initiator"]).toBeUndefined()
    expect(output.headers["x-copilot-is-agent"]).toBeUndefined()
    expect(output.headers["openai-is-agent"]).toBeUndefined()
  })

  test("SSSDK active: first message returns early (SDK sets user)", async () => {
    const mock = makeMockClient(0)
    const handler = createChatHeadersHandler({ ctx: mock as never })
    const output: { headers: Record<string, string> } = { headers: {} }

    await handler(
      {
        sessionID: "ses_ssdk",
        provider: { id: "github-copilot" },
        model: { api: { npm: "@ai-sdk/github-copilot" } },
        message: { id: "msg_ssdk_1", role: "user" },
      },
      output,
    )

    // No headers set — letting SDK handle the billing handshake
    expect(output.headers["x-initiator"]).toBeUndefined()
  })

  test("SSSDK active: second message sets agent headers", async () => {
    const mock = makeMockClient(0)
    const handler = createChatHeadersHandler({ ctx: mock as never })
    const output1: { headers: Record<string, string> } = { headers: {} }
    const output2: { headers: Record<string, string> } = { headers: {} }

    // First call: first billing, SSSD path, returns early
    await handler(
      {
        sessionID: "ses_ssdk2",
        provider: { id: "github-copilot" },
        model: { api: { npm: "@ai-sdk/github-copilot" } },
        message: { id: "msg_ssdk2_1", role: "user" },
      },
      output1,
    )
    // Second call: billedSessionSet has session → NOT first → set agent headers
    await handler(
      {
        sessionID: "ses_ssdk2",
        provider: { id: "github-copilot" },
        model: { api: { npm: "@ai-sdk/github-copilot" } },
        message: { id: "msg_ssdk2_2", role: "user" },
      },
      output2,
    )

    expect(output1.headers["x-initiator"]).toBeUndefined()
    expect(output2.headers["x-initiator"]).toBe("agent")
    expect(output2.headers["x-copilot-is-agent"]).toBe("true")
    expect(output2.headers["openai-is-agent"]).toBe("true")
  })

  test("first message for Copilot Enterprise also gets user", async () => {
    const mock = makeMockClient(0)
    const handler = createChatHeadersHandler({ ctx: mock as never })
    const output: { headers: Record<string, string> } = { headers: {} }

    await handler(
      {
        sessionID: "ses_ent",
        provider: { id: "github-copilot-enterprise" },
        message: { id: "msg_ent_1", role: "user" },
      },
      output,
    )

    expect(output.headers["x-initiator"]).toBe("user")
  })

  test("resumed session with existing messages: session.messages()=5 → agent", async () => {
    // Session already has 5 messages from a previous server run.
    // session.messages() returns 5 → existingCount=5 → NOT first billing
    const mock = makeMockClient(5)
    const handler = createChatHeadersHandler({ ctx: mock as never })
    const output: { headers: Record<string, string> } = { headers: {} }

    await handler(
      {
        sessionID: "ses_resumed",
        provider: { id: "github-copilot" },
        message: { id: "msg_new", role: "user" },
      },
      output,
    )

    expect(output.headers["x-initiator"]).toBe("agent")
    expect(output.headers["x-copilot-is-agent"]).toBe("true")
    expect(output.headers["openai-is-agent"]).toBe("true")
  })
})
