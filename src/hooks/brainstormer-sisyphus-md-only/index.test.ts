import { describe, expect, test } from "bun:test"
import { mkdirSync, writeFileSync } from "node:fs"
import { createBrainstormerSisyphusMdOnlyHook } from "./hook"
import * as sessionState from "../../features/claude-code-session-state"

describe("brainstormer-sisyphus-md-only", () => {
  const hook = createBrainstormerSisyphusMdOnlyHook({
    directory: "/tmp/test",
    client: {},
  } as never)

  test("allows brainstormer writes to brainstorm handoff files", async () => {
    mkdirSync("/tmp/test/.sisyphus/drafts", { recursive: true })
    sessionState.updateSessionAgent("ses-brainstormer", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer", callID: "c1" }
    const output = { args: { filePath: ".sisyphus/drafts/brainstorm-auth-flow.md" } }

    await expect(hook["tool.execute.before"](input, output)).resolves.toBeUndefined()
  })

  test("allows brainstormer writes to brainstorm handoff files in brainstorms subdirectory", async () => {
    mkdirSync("/tmp/test/.sisyphus/drafts/brainstorms", { recursive: true })
    sessionState.updateSessionAgent("ses-brainstormer-1b", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer-1b", callID: "c1b" }
    const output = { args: { filePath: ".sisyphus/drafts/brainstorms/brainstorm-ui-polish.md" } }

    await expect(hook["tool.execute.before"](input, output)).resolves.toBeUndefined()
  })

  test("blocks brainstormer writes to non-brainstorm markdown files", async () => {
    sessionState.updateSessionAgent("ses-brainstormer-2", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer-2", callID: "c2" }
    const output = { args: { filePath: ".sisyphus/drafts/idea.md" } }

    await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
      "Brainstormer may only write brainstorm handoff files",
    )
  })

  test("blocks brainstormer writes outside .sisyphus", async () => {
    sessionState.updateSessionAgent("ses-brainstormer-2", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer-2", callID: "c2" }
    const output = { args: { filePath: "src/main.ts" } }

    await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
      "Brainstormer may only write brainstorm handoff files",
    )
  })

  test("blocks brainstormer apply_patch usage outside brainstorm files", async () => {
    sessionState.updateSessionAgent("ses-brainstormer-3", "brainstormer")
    const input = { tool: "apply_patch", sessionID: "ses-brainstormer-3", callID: "c3" }
    const output = { args: { filePath: "src/main.ts" } }

    await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
      "Brainstormer may only create brainstorm handoff files via Write",
    )
  })

  test("blocks brainstormer edit tool even for brainstorm file path", async () => {
    sessionState.updateSessionAgent("ses-brainstormer-4", "brainstormer")
    const input = { tool: "Edit", sessionID: "ses-brainstormer-4", callID: "c4" }
    const output = { args: { filePath: ".sisyphus/drafts/brainstorm-auth-flow.md" } }

    await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
      "Brainstormer may only create brainstorm handoff files via Write",
    )
  })

  test("blocks brainstormer overwrite when brainstorm file already exists", async () => {
    mkdirSync("/tmp/test/.sisyphus/drafts", { recursive: true })
    writeFileSync("/tmp/test/.sisyphus/drafts/brainstorm-existing.md", "existing")

    sessionState.updateSessionAgent("ses-brainstormer-5", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer-5", callID: "c5" }
    const output = { args: { filePath: ".sisyphus/drafts/brainstorm-existing.md" } }

    await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
      "Brainstormer may only create new brainstorm handoff files",
    )
  })
})
