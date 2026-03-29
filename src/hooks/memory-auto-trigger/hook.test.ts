import { describe, expect, it } from "bun:test"
import { createMemoryAutoTriggerHook } from "./hook"

describe("memory-auto-trigger hook", () => {
  const ctx = { directory: "/repo/project" } as never

  it("injects recall once per session", async () => {
    const hook = createMemoryAutoTriggerHook(ctx)
    const output = { parts: [{ type: "text", text: "Investigate auth regressions" }] }

    await hook["chat.message"]?.({ sessionID: "ses-1", agent: "sisyphus" }, output)
    expect(output.parts[0]?.text).toContain("MEMORY AUTO-RECALL")

    const output2 = { parts: [{ type: "text", text: "Continue" }] }
    await hook["chat.message"]?.({ sessionID: "ses-1", agent: "sisyphus" }, output2)
    expect(output2.parts[0]?.text).not.toContain("MEMORY AUTO-RECALL")
  })

  it("injects capture for substantial discovery output and respects duplicate tag guard", async () => {
    const hook = createMemoryAutoTriggerHook(ctx)
    const baseOutput = "x".repeat(400)
    const out = { title: "ok", output: baseOutput, metadata: {} as Record<string, unknown> }

    await hook["tool.execute.after"]?.(
      { tool: "grep", sessionID: "ses-2", callID: "c1", agent: "sisyphus" },
      out,
    )
    expect(out.output).toContain("MEMORY AUTO-CAPTURE")

    const out2 = { title: "ok", output: out.output, metadata: {} as Record<string, unknown> }
    await hook["tool.execute.after"]?.(
      { tool: "task", sessionID: "ses-2", callID: "c2", agent: "sisyphus" },
      out2,
    )
    const tagCount = (out2.output.match(/MEMORY AUTO-CAPTURE/g) ?? []).length
    expect(tagCount).toBe(1)
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
})
