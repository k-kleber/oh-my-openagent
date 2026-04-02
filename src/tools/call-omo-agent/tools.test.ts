/// <reference types="bun-types" />
const { beforeEach, describe, test, expect, mock } = require("bun:test")
const { createCallOmoAgent } = require("./tools")

function createMockClientWithAgents(agents: Array<{ name: string; mode?: string }>) {
  return {
    app: {
      agents: mock(() => Promise.resolve({ data: agents })),
    },
    session: {
      messages: mock(() => Promise.resolve({ data: [] })),
    },
  }
}

describe("createCallOmoAgent", () => {
  const assertCanSpawnMock = mock(() => Promise.resolve(undefined))
  const reserveCommitMock = mock(() => 1)
  const reserveRollbackMock = mock(() => {})
  const reserveSubagentSpawnMock = mock(() => Promise.resolve({
    spawnContext: { rootSessionID: "root-session", parentDepth: 0, childDepth: 1 },
    descendantCount: 1,
    commit: reserveCommitMock,
    rollback: reserveRollbackMock,
  }))
  const mockCtx = {
    client: {},
    directory: "/test",
  }

  const mockBackgroundManager = {
    assertCanSpawn: assertCanSpawnMock,
    reserveSubagentSpawn: reserveSubagentSpawnMock,
    launch: mock(() => Promise.resolve({
      id: "test-task-id",
      sessionID: null,
      description: "Test task",
      agent: "test-agent",
      status: "pending",
    })),
  }

  beforeEach(() => {
    assertCanSpawnMock.mockClear()
    reserveSubagentSpawnMock.mockClear()
    reserveCommitMock.mockClear()
    reserveRollbackMock.mockClear()
  })

  test("should reject agent in disabled_agents list", async () => {
    //#given
    const toolDef = createCallOmoAgent(mockCtx, mockBackgroundManager, ["explore"])
    const executeFunc = toolDef.execute as Function

    //#when
    const result = await executeFunc(
      {
        description: "Test",
        prompt: "Test prompt",
        subagent_type: "explore",
        run_in_background: true,
      },
      { sessionID: "test", messageID: "msg", agent: "test", abort: new AbortController().signal }
    )

    //#then
    expect(result).toContain("disabled via disabled_agents")
  })

  test("should reject agent in disabled_agents list with case-insensitive matching", async () => {
    //#given
    const toolDef = createCallOmoAgent(mockCtx, mockBackgroundManager, ["Explore"])
    const executeFunc = toolDef.execute as Function

    //#when
    const result = await executeFunc(
      {
        description: "Test",
        prompt: "Test prompt",
        subagent_type: "explore",
        run_in_background: true,
      },
      { sessionID: "test", messageID: "msg", agent: "test", abort: new AbortController().signal }
    )

    //#then
    expect(result).toContain("disabled via disabled_agents")
  })

  test("should allow agent not in disabled_agents list", async () => {
    //#given
    const toolDef = createCallOmoAgent(mockCtx, mockBackgroundManager, ["librarian"])
    const executeFunc = toolDef.execute as Function

    //#when
    const result = await executeFunc(
      {
        description: "Test",
        prompt: "Test prompt",
        subagent_type: "explore",
        run_in_background: true,
      },
      { sessionID: "test", messageID: "msg", agent: "test", abort: new AbortController().signal }
    )

    //#then
    // Should not contain disabled error - may fail for other reasons but disabled check should pass
    expect(result).not.toContain("disabled via disabled_agents")
  })

  test("should allow all agents when disabled_agents is empty", async () => {
    //#given
    const toolDef = createCallOmoAgent(mockCtx, mockBackgroundManager, [])
    const executeFunc = toolDef.execute as Function

    //#when
    const result = await executeFunc(
      {
        description: "Test",
        prompt: "Test prompt",
        subagent_type: "explore",
        run_in_background: true,
      },
      { sessionID: "test", messageID: "msg", agent: "test", abort: new AbortController().signal }
    )

    //#then
    expect(result).not.toContain("disabled via disabled_agents")
  })

  test("uses agent override fallback_models when launching background subagent", async () => {
    //#given
    const launch = mock((_input: { fallbackChain?: Array<{ providers: string[]; model: string; variant?: string }> }) => Promise.resolve({
      id: "task-fallback",
      sessionID: "sub-session",
      description: "Test task",
      agent: "explore",
      status: "pending",
    }))
    const managerWithLaunch = {
      launch,
      getTask: mock(() => undefined),
    }
    const toolDef = createCallOmoAgent(
      mockCtx,
      managerWithLaunch,
      [],
      {
        explore: {
          fallback_models: ["quotio/kimi-k2.5", "openai/gpt-5.2(high)"],
        },
      },
    )
    const executeFunc = toolDef.execute as Function

    //#when
    await executeFunc(
      {
        description: "Test fallback",
        prompt: "Test prompt",
        subagent_type: "explore",
        run_in_background: true,
      },
      { sessionID: "test", messageID: "msg", agent: "test", abort: new AbortController().signal }
    )

    //#then
    const firstLaunchCall = launch.mock.calls[0]
    if (firstLaunchCall === undefined) {
      throw new Error("Expected launch to be called")
    }

    const [launchArgs] = firstLaunchCall
    expect(launchArgs.fallbackChain).toEqual([
      { providers: ["quotio"], model: "kimi-k2.5", variant: undefined },
      { providers: ["openai"], model: "gpt-5.2", variant: "high" },
    ])
  })

  test("should return a tool error when sync spawn depth validation fails", async () => {
    //#given
    reserveSubagentSpawnMock.mockRejectedValueOnce(new Error("Subagent spawn blocked: child depth 4 exceeds background_task.maxDepth=3."))
    const toolDef = createCallOmoAgent(mockCtx, mockBackgroundManager, [])
    const executeFunc = toolDef.execute as Function

    //#when
    const result = await executeFunc(
      {
        description: "Test",
        prompt: "Test prompt",
        subagent_type: "explore",
        run_in_background: false,
      },
      { sessionID: "test", messageID: "msg", agent: "test", abort: new AbortController().signal },
    )

    //#then
    expect(result).toContain("background_task.maxDepth=3")
  })

  test("blocks primary runtime agents", async () => {
    //#given
    const toolDef = createCallOmoAgent(
      {
        ...mockCtx,
        client: createMockClientWithAgents([
          { name: "explore", mode: "subagent" },
          { name: "oracle", mode: "primary" },
        ]),
      },
      mockBackgroundManager,
      [],
    )
    const executeFunc = toolDef.execute as Function

    //#when
    const result = await executeFunc(
      {
        description: "Test",
        prompt: "Test prompt",
        subagent_type: "oracle",
        run_in_background: true,
      },
      { sessionID: "test", messageID: "msg", agent: "test", abort: new AbortController().signal },
    )

    //#then
    expect(result).toContain("Cannot call non-subagent agent \"oracle\"")
  })

  test("blocks all-mode runtime agents", async () => {
    //#given
    const toolDef = createCallOmoAgent(
      {
        ...mockCtx,
        client: createMockClientWithAgents([
          { name: "explore", mode: "subagent" },
          { name: "hephaestus", mode: "all" },
        ]),
      },
      mockBackgroundManager,
      [],
    )
    const executeFunc = toolDef.execute as Function

    //#when
    const result = await executeFunc(
      {
        description: "Test",
        prompt: "Test prompt",
        subagent_type: "hephaestus",
        run_in_background: true,
      },
      { sessionID: "test", messageID: "msg", agent: "test", abort: new AbortController().signal },
    )

    //#then
    expect(result).toContain("Cannot call non-subagent agent \"hephaestus\"")
  })

  test("allows subagent runtime agents", async () => {
    //#given
    const toolDef = createCallOmoAgent(
      {
        ...mockCtx,
        client: createMockClientWithAgents([{ name: "explore", mode: "subagent" }]),
      },
      mockBackgroundManager,
      [],
    )
    const executeFunc = toolDef.execute as Function

    //#when
    const result = await executeFunc(
      {
        description: "Test",
        prompt: "Test prompt",
        subagent_type: "explore",
        run_in_background: true,
      },
      { sessionID: "test", messageID: "msg", agent: "test", abort: new AbortController().signal },
    )

    //#then
    expect(result).not.toContain("Cannot call non-subagent agent")
  })

  test("blocks call_omo_agent when caller is brainstormer", async () => {
    //#given
    const toolDef = createCallOmoAgent(mockCtx, mockBackgroundManager, [])
    const executeFunc = toolDef.execute as Function

    //#when
    const result = await executeFunc(
      {
        description: "Test",
        prompt: "Test prompt",
        subagent_type: "explore",
        run_in_background: true,
      },
      { sessionID: "test", messageID: "msg", agent: "brainstormer", abort: new AbortController().signal },
    )

    //#then
    expect(result).toContain("Brainstormer cannot use call_omo_agent")
  })

  test("deduplicates concurrent background launches for the same callID", async () => {
    //#given
    const launch = mock(() => Promise.resolve({
      id: "bg_same_call",
      sessionID: "ses_same_call",
      description: "Test task",
      agent: "explore",
      status: "pending",
    }))
    const managerWithLaunch = {
      launch,
      getTask: mock(() => ({ sessionID: "ses_same_call" })),
    }
    const toolDef = createCallOmoAgent(
      {
        ...mockCtx,
        client: {
          session: { messages: mock(() => Promise.resolve({ data: [] })) },
        },
      },
      managerWithLaunch,
      [],
    )
    const executeFunc = toolDef.execute as Function
    const args = {
      description: "Test",
      prompt: "Test prompt",
      subagent_type: "explore",
      run_in_background: true,
    }
    const toolContext = {
      sessionID: "test",
      messageID: "msg",
      agent: "test",
      callID: "call-dedupe-1",
      abort: new AbortController().signal,
    }

    //#when
    const [resultA, resultB] = await Promise.all([
      executeFunc(args, toolContext),
      executeFunc(args, toolContext),
    ])

    //#then
    expect(launch).toHaveBeenCalledTimes(1)
    expect(resultA).toContain("Task ID: bg_same_call")
    expect(resultB).toContain("Task ID: bg_same_call")
  })

  test("does not deduplicate launches across different callIDs", async () => {
    //#given
    const launch = mock(() => Promise.resolve({
      id: "bg_default",
      sessionID: "ses_multi_call",
      description: "Test task",
      agent: "explore",
      status: "pending",
    }))
    launch.mockImplementationOnce(() => Promise.resolve({
      id: "bg_call_a",
      sessionID: "ses_multi_call",
      description: "Test task",
      agent: "explore",
      status: "pending",
    }))
    launch.mockImplementationOnce(() => Promise.resolve({
      id: "bg_call_b",
      sessionID: "ses_multi_call",
      description: "Test task",
      agent: "explore",
      status: "pending",
    }))
    const managerWithLaunch = {
      launch,
      getTask: mock(() => ({ sessionID: "ses_multi_call" })),
    }
    const toolDef = createCallOmoAgent(
      {
        ...mockCtx,
        client: {
          session: { messages: mock(() => Promise.resolve({ data: [] })) },
        },
      },
      managerWithLaunch,
      [],
    )
    const executeFunc = toolDef.execute as Function
    const args = {
      description: "Test",
      prompt: "Test prompt",
      subagent_type: "explore",
      run_in_background: true,
    }

    //#when
    await executeFunc(args, {
      sessionID: "test",
      messageID: "msg",
      agent: "test",
      callID: "call-dedupe-2a",
      abort: new AbortController().signal,
    })
    await executeFunc(args, {
      sessionID: "test",
      messageID: "msg",
      agent: "test",
      callID: "call-dedupe-2b",
      abort: new AbortController().signal,
    })

    //#then
    expect(launch).toHaveBeenCalledTimes(2)
  })
})
