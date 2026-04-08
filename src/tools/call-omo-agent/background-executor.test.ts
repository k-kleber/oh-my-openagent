/// <reference types="bun-types" />
import { describe, test, expect, mock } from "bun:test"
import type { BackgroundManager } from "../../features/background-agent"
import type { PluginInput } from "@opencode-ai/plugin"
import { executeBackground } from "./background-executor"

type LaunchResult = {
  id: string
  sessionID: string | null
  description: string
  agent: string
  status: string
}

type LaunchInput = {
  fallbackChain?: Array<{ providers: string[]; model: string; variant?: string }>
  model?: { providerID: string; modelID: string; variant?: string }
}

describe("executeBackground", () => {
  const launchMock = mock((_: LaunchInput): Promise<LaunchResult> => Promise.resolve({
    id: "test-task-id",
    sessionID: null,
    description: "Test task",
    agent: "test-agent",
    status: "pending",
  }))
  const getTaskMock = mock()

  const mockManager = {
    launch: launchMock,
    getTask: getTaskMock,
  } as unknown as BackgroundManager

  const testContext = {
    sessionID: "test-session",
    messageID: "test-message",
    agent: "test-agent",
    abort: new AbortController().signal,
  }

  const testArgs = {
    description: "Test background task",
    prompt: "Test prompt",
    subagent_type: "test-agent",
    run_in_background: true,
  }

  const mockClient = {
    session: {
      messages: mock(() => Promise.resolve({ data: [] })),
    },
  } as unknown as PluginInput["client"]

  test("detects interrupted task as failure", async () => {
    //#given
    launchMock.mockResolvedValueOnce({
      id: "test-task-id",
      sessionID: null,
      description: "Test task",
      agent: "test-agent",
      status: "pending",
    })
    getTaskMock.mockReturnValueOnce({
      id: "test-task-id",
      sessionID: null,
      description: "Test task",
      agent: "test-agent",
      status: "interrupt",
    })

    //#when
    const result = await executeBackground(testArgs, testContext, mockManager, mockClient)

    //#then
    expect(result).toContain("Task failed to start")
    expect(result).toContain("interrupt")
    expect(result).toContain("test-task-id")
  })

  test("passes fallbackChain to background manager launch", async () => {
    //#given
    const fallbackChain = [
      { providers: ["quotio"], model: "kimi-k2.5", variant: undefined },
      { providers: ["openai"], model: "gpt-5.2", variant: "high" },
    ]
    launchMock.mockResolvedValueOnce({
      id: "test-task-id",
      sessionID: "sub-session",
      description: "Test task",
      agent: "test-agent",
      status: "pending",
    })

    //#when
    await executeBackground(testArgs, testContext, mockManager, mockClient, fallbackChain)

    //#then
    const launchArgs = launchMock.mock.calls[launchMock.mock.calls.length - 1]?.[0] as LaunchInput | undefined
    if (!launchArgs) {
      throw new Error("Expected launch args to be captured")
    }
    expect(launchArgs.fallbackChain).toEqual(fallbackChain)
  })

  test("passes resolved model override to background manager launch and metadata", async () => {
    //#given
    const resolvedModel = {
      providerID: "github-copilot",
      modelID: "gemini-3-flash-preview",
      variant: "high",
    }
    const metadata = mock(async () => {})
    launchMock.mockResolvedValueOnce({
      id: "test-task-id",
      sessionID: "sub-session",
      description: "Test task",
      agent: "deep-explorer",
      status: "pending",
    })

    //#when
    await executeBackground(
      { ...testArgs, subagent_type: "deep-explorer" },
      { ...testContext, metadata },
      mockManager,
      mockClient,
      undefined,
      resolvedModel,
    )

    //#then
    const launchArgs = launchMock.mock.calls[launchMock.mock.calls.length - 1]?.[0] as LaunchInput | undefined
    if (!launchArgs) {
      throw new Error("Expected launch args to be captured")
    }
    expect(launchArgs.model).toEqual(resolvedModel)
    expect(metadata).toHaveBeenCalledWith({
      title: "Test background task",
      metadata: {
        sessionId: "sub-session",
        model: resolvedModel,
      },
    })
  })
})
