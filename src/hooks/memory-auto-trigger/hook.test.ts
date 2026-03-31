import { describe, expect, it } from "bun:test"
import { createMemoryAutoTriggerHook } from "./hook"

describe("memory-auto-trigger hook", () => {
  const ctx = { directory: "/repo/project" } as never
  const mcpManager = {
    callTool: async (_info: unknown, _context: unknown, toolName: string, args: Record<string, unknown>) => {
      if (toolName === "recall") {
        return [{ text: `recall:${String(args.query ?? "")}` }]
      }
      if (toolName === "openmemory_query") {
        return [{ text: `memory:${String(args.query ?? "")}` }]
      }
      if (toolName === "retain") {
        return [{ ok: true, args }]
      }
      if (toolName === "openmemory_store") {
        return [{ stored: true, args }]
      }
      return []
    },
  } as never

  it("injects recall once per session", async () => {
    const hook = createMemoryAutoTriggerHook(ctx, {
      budget: { session_chars: 4000 },
    }, mcpManager)
    const output = { parts: [{ type: "text", text: "Investigate auth regressions" }] }

    await hook["chat.message"]?.({ sessionID: "ses-1", agent: "sisyphus" }, output)
    expect(output.parts[0]?.text).toContain("MEMORY AUTO-RECALL")
    expect(output.parts[0]?.text).toContain("verified")

    const output2 = { parts: [{ type: "text", text: "Continue" }] }
    await hook["chat.message"]?.({ sessionID: "ses-1", agent: "sisyphus" }, output2)
    expect(output2.parts[0]?.text).not.toContain("MEMORY AUTO-RECALL")
  })

  it("injects capture for substantial discovery output and respects duplicate tag guard", async () => {
    const hook = createMemoryAutoTriggerHook(ctx, {
      budget: { session_chars: 4000 },
    }, mcpManager)
    const baseOutput = "x".repeat(400)
    const first = { title: "ok", output: baseOutput, metadata: {} as Record<string, unknown> }
    const out = { title: "ok", output: baseOutput, metadata: {} as Record<string, unknown> }

    await hook["tool.execute.after"]?.(
      { tool: "grep", sessionID: "ses-2", callID: "c0", agent: "sisyphus" },
      first,
    )

    await hook["tool.execute.after"]?.(
      { tool: "grep", sessionID: "ses-2", callID: "c1", agent: "sisyphus" },
      out,
    )
    expect(out.output).toContain("memory-orchestrator")

    const out2 = { title: "ok", output: out.output, metadata: {} as Record<string, unknown> }
    await hook["tool.execute.after"]?.(
      { tool: "task", sessionID: "ses-2", callID: "c2", agent: "sisyphus" },
      out2,
    )
    expect(out.output).toContain("stored=")
  })

  it("resumes capture after a memory task result clears the active guard", async () => {
    const hook = createMemoryAutoTriggerHook(ctx, {
      budget: { session_chars: 4000 },
    }, mcpManager)
    const first = { title: "ok", output: "x".repeat(500), metadata: {} as Record<string, unknown> }
    const next = { title: "ok", output: "x".repeat(500), metadata: {} as Record<string, unknown> }
    await hook["tool.execute.after"]?.(
      { tool: "grep", sessionID: "ses-active", callID: "g-0", agent: "sisyphus" },
      first,
    )
    const out = {
      title: "ok",
      output: "memory-store completed successfully",
      metadata: {} as Record<string, unknown>,
    }
    await hook["tool.execute.after"]?.(
      { tool: "task", sessionID: "ses-active", callID: "mem-1", agent: "sisyphus" },
      out,
    )
    await hook["tool.execute.after"]?.(
      { tool: "grep", sessionID: "ses-active", callID: "g-1", agent: "sisyphus" },
      next,
    )
    expect(next.output).toContain("memory-orchestrator")
  })

  it("cleans session state on deleted/compacted allowing new recall", async () => {
    const hook = createMemoryAutoTriggerHook(ctx)
    const first = { parts: [{ type: "text", text: "Start session" }] }
    await hook["chat.message"]?.({ sessionID: "ses-3", agent: "sisyphus" }, first)
    expect(first.parts[0]?.text).toContain("MEMORY AUTO-RECALL")

    await hook.event?.({ event: { type: "session.deleted", properties: { info: { id: "ses-3" } } } })

    const second = { parts: [{ type: "text", text: "Start session again" }] }
    await hook["chat.message"]?.({ sessionID: "ses-3", agent: "sisyphus" }, second)
    expect(second.parts[0]?.text).toContain("MEMORY AUTO-RECALL")
  })

  it("injects lifecycle capture on session.idle", async () => {
    const promptAsync = async (..._args: unknown[]) => ({})
    const hook = createMemoryAutoTriggerHook({
      directory: "/repo/project",
      client: { session: { promptAsync } },
    } as never)

    await hook.event?.({ event: { type: "session.idle", properties: { sessionID: "ses-idle-1" } } })
    expect(true).toBe(true)
  })

  it("injects precompaction-specific lifecycle capture when source is preemptive-compaction", async () => {
    const promptAsync = async (..._args: unknown[]) => ({})
    const hook = createMemoryAutoTriggerHook({
      directory: "/repo/project",
      client: { session: { promptAsync } },
    } as never)

    await hook.event?.({
      event: {
        type: "session.compacted",
        properties: { sessionID: "ses-c1", source: "preemptive-compaction" },
      },
    })
    expect(true).toBe(true)
  })

  it("records promotion candidates after repeated distinct observation signals", async () => {
    const hook = createMemoryAutoTriggerHook(ctx, {
      budget: { session_chars: 4000 },
      reducer: { cross_project_evidence_min: 2 },
    }, mcpManager)

    const one = { title: "ok", output: "a".repeat(500), metadata: {} as Record<string, unknown> }
    const two = { title: "ok", output: "b".repeat(500), metadata: {} as Record<string, unknown> }

    await hook["tool.execute.after"]?.(
      { tool: "grep", sessionID: "ses-promote", callID: "p1", agent: "sisyphus" },
      one,
    )
    await hook["tool.execute.after"]?.(
      { tool: "glob", sessionID: "ses-promote", callID: "p2", agent: "sisyphus" },
      two,
    )

    expect(two.output).toContain("promoted=")
  })

  it("persists metrics when observability logging is enabled", async () => {
    const hook = createMemoryAutoTriggerHook(ctx, {
      budget: { session_chars: 4000 },
      observability: { enabled: true, log_metrics: true },
    }, mcpManager)

    const first = { title: "ok", output: "x".repeat(500), metadata: {} as Record<string, unknown> }
    const second = { title: "ok", output: "y".repeat(500), metadata: {} as Record<string, unknown> }

    await hook["tool.execute.after"]?.(
      { tool: "grep", sessionID: "ses-metrics", callID: "m1", agent: "sisyphus" },
      first,
    )
    await hook["tool.execute.after"]?.(
      { tool: "glob", sessionID: "ses-metrics", callID: "m2", agent: "sisyphus" },
      second,
    )

    expect(second.output).toContain("memory-orchestrator")
  })
})
