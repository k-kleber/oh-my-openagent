import { describe, expect, test } from "bun:test"

import { OMO_INTERNAL_INITIATOR_MARKER } from "../shared"
import { createChatHeadersHandler } from "./chat-headers"

describe("createChatHeadersHandler", () => {
  test("sets all 2026 agent mode headers for Copilot internal marker messages", async () => {
    const handler = createChatHeadersHandler({
      ctx: {
        client: {
          session: {
            message: async () => ({
              data: {
                parts: [
                  {
                    type: "text",
                    text: `notification\n${OMO_INTERNAL_INITIATOR_MARKER}`,
                  },
                ],
              },
            }),
          },
        },
      } as never,
    })
    const output: { headers: Record<string, string> } = { headers: {} }

    await handler(
      {
        sessionID: "ses_1",
        provider: { id: "github-copilot" },
        message: {
          id: "msg_1",
          role: "user",
        },
      },
      output,
    )

    // All 2026 agent mode headers should be set
    expect(output.headers["x-initiator"]).toBe("agent")
    expect(output.headers["x-copilot-is-agent"]).toBe("true")
    expect(output.headers["openai-is-agent"]).toBe("true")
  })

  test("does not set headers for non-copilot providers", async () => {
    const handler = createChatHeadersHandler({
      ctx: {
        client: {
          session: {
            message: async () => ({
              data: {
                parts: [
                  {
                    type: "text",
                    text: `notification\n${OMO_INTERNAL_INITIATOR_MARKER}`,
                  },
                ],
              },
            }),
          },
        },
      } as never,
    })
    const output: { headers: Record<string, string> } = { headers: {} }

    await handler(
      {
        sessionID: "ses_1",
        provider: { id: "openai" },
        message: {
          id: "msg_2",
          role: "user",
        },
      },
      output,
    )

    // No headers should be set for non-copilot providers
    expect(output.headers["x-initiator"]).toBeUndefined()
    expect(output.headers["x-copilot-is-agent"]).toBeUndefined()
    expect(output.headers["openai-is-agent"]).toBeUndefined()
  })

  test("sets 2026 agent mode headers even for regular user messages", async () => {
    const handler = createChatHeadersHandler({
      ctx: {
        client: {
          session: {
            message: async () => ({
              data: {
                parts: [{ type: "text", text: "normal user message" }],
              },
            }),
          },
        },
      } as never,
    })
    const output: { headers: Record<string, string> } = { headers: {} }

    await handler(
      {
        sessionID: "ses_3",
        provider: { id: "github-copilot" },
        message: {
          id: "msg_3",
          role: "user",
        },
      },
      output,
    )

    // Headers are now always set for Copilot, regardless of internal marker
    expect(output.headers["x-initiator"]).toBe("agent")
    expect(output.headers["x-copilot-is-agent"]).toBe("true")
    expect(output.headers["openai-is-agent"]).toBe("true")
  })

  test("sets all headers even when model uses @ai-sdk/github-copilot", async () => {
    const handler = createChatHeadersHandler({
      ctx: {
        client: {
          session: {
            message: async () => ({
              data: {
                parts: [
                  {
                    type: "text",
                    text: `notification\n${OMO_INTERNAL_INITIATOR_MARKER}`,
                  },
                ],
              },
            }),
          },
        },
      } as never,
    })
    const output: { headers: Record<string, string> } = { headers: {} }

    await handler(
      {
        sessionID: "ses_4",
        provider: { id: "github-copilot" },
        model: { api: { npm: "@ai-sdk/github-copilot" } },
        message: {
          id: "msg_4",
          role: "user",
        },
      },
      output,
    )

    // Headers should be set even when SDK is active
    expect(output.headers["x-initiator"]).toBe("agent")
    expect(output.headers["x-copilot-is-agent"]).toBe("true")
    expect(output.headers["openai-is-agent"]).toBe("true")
  })

  test("sets headers for Copilot Enterprise provider", async () => {
    const handler = createChatHeadersHandler({
      ctx: {
        client: {
          session: {
            message: async () => ({
              data: {
                parts: [{ type: "text", text: "regular message" }],
              },
            }),
          },
        },
      } as never,
    })
    const output: { headers: Record<string, string> } = { headers: {} }

    await handler(
      {
        sessionID: "ses_5",
        provider: { id: "github-copilot-enterprise" },
        message: {
          id: "msg_5",
          role: "user",
        },
      },
      output,
    )

    // Headers should be set for Copilot Enterprise too
    expect(output.headers["x-initiator"]).toBe("agent")
    expect(output.headers["x-copilot-is-agent"]).toBe("true")
    expect(output.headers["openai-is-agent"]).toBe("true")
  })
})
