import { describe, expect, test } from "bun:test"
import { createBrainstormerSisyphusMdOnlyHook } from "./hook"
import * as sessionState from "../../features/claude-code-session-state"

describe("brainstormer-sisyphus-md-only", () => {
  const hook = createBrainstormerSisyphusMdOnlyHook({
    directory: "/tmp/test",
    client: {},
  } as never)

  test("allows brainstormer writes under .sisyphus/*.md", async () => {
    sessionState.updateSessionAgent("ses-brainstormer", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer", callID: "c1" }
    const output = { args: { filePath: ".sisyphus/drafts/idea.md" } }

    await expect(hook["tool.execute.before"](input, output)).resolves.toBeUndefined()
  })

  test("blocks brainstormer writes outside .sisyphus", async () => {
    sessionState.updateSessionAgent("ses-brainstormer-2", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer-2", callID: "c2" }
    const output = { args: { filePath: "src/main.ts" } }

    await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
      "Brainstormer may only modify markdown files under .sisyphus/",
    )
  })
})
