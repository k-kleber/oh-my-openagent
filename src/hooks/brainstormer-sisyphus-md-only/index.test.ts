import { describe, expect, test, beforeEach } from "bun:test"
import { mkdirSync, writeFileSync, rmSync } from "node:fs"
import { createBrainstormerSisyphusMdOnlyHook } from "./hook"
import * as sessionState from "../../features/claude-code-session-state"

// Cleanup before tests
beforeEach(() => {
  rmSync("/tmp/test", { force: true, recursive: true })
})

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

    // Should NOT throw - allowed to create new brainstorm files
    await expect(hook["tool.execute.before"](input, output)).resolves.toBeUndefined()
  })

  test("allows brainstormer writes to brainstorm files in brainstorms subdirectory", async () => {
    mkdirSync("/tmp/test/.sisyphus/drafts/brainstorms", { recursive: true })
    sessionState.updateSessionAgent("ses-brainstormer-1b", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer-1b", callID: "c1b" }
    const output = { args: { filePath: ".sisyphus/drafts/brainstorms/brainstorm-ui-polish.md" } }

    // Should NOT throw - allowed to create new brainstorm files in brainstorms/
    await expect(hook["tool.execute.before"](input, output)).resolves.toBeUndefined()
  })

  test("allows brainstormer writes to notes files", async () => {
    mkdirSync("/tmp/test/.sisyphus/drafts", { recursive: true })
    sessionState.updateSessionAgent("ses-brainstormer-notes", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer-notes", callID: "c1" }
    const output = { args: { filePath: ".sisyphus/drafts/notes-auth-design.md" } }

    // Should NOT throw - allowed to create new notes files
    await expect(hook["tool.execute.before"](input, output)).resolves.toBeUndefined()
  })

  test("allows brainstormer writes to research files", async () => {
    mkdirSync("/tmp/test/.sisyphus/drafts", { recursive: true })
    sessionState.updateSessionAgent("ses-brainstormer-research", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer-research", callID: "c1" }
    const output = { args: { filePath: ".sisyphus/drafts/research-alternatives.md" } }

    // Should NOT throw - allowed to create new research files
    await expect(hook["tool.execute.before"](input, output)).resolves.toBeUndefined()
  })

  test("blocks brainstormer writes to non-brainstorm markdown files", async () => {
    sessionState.updateSessionAgent("ses-brainstormer-2", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer-2", callID: "c2" }
    const output = { args: { filePath: ".sisyphus/drafts/idea.md" } }

    await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
      "Brainstormer can only create new brainstorm/notes/research files",
    )
  })

  test("blocks brainstormer writes outside .sisyphus", async () => {
    sessionState.updateSessionAgent("ses-brainstormer-2", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer-2", callID: "c2" }
    const output = { args: { filePath: "src/main.ts" } }

    await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
      "Brainstormer can only create new brainstorm/notes/research files",
    )
  })

  test("blocks brainstormer apply_patch usage", async () => {
    sessionState.updateSessionAgent("ses-brainstormer-3", "brainstormer")
    const input = { tool: "apply_patch", sessionID: "ses-brainstormer-3", callID: "c3" }
    const output = { args: { filePath: "src/main.ts" } }

    await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
      "Brainstormer can only create new brainstorm/notes/research files",
    )
  })

  test("blocks brainstormer edit tool even for brainstorm file path", async () => {
    sessionState.updateSessionAgent("ses-brainstormer-4", "brainstormer")
    const input = { tool: "Edit", sessionID: "ses-brainstormer-4", callID: "c4" }
    const output = { args: { filePath: ".sisyphus/drafts/brainstorm-auth-flow.md" } }

    await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
      "Brainstormer is read-only. Cannot modify files",
    )
  })

  test("blocks brainstormer overwrite when brainstorm file already exists", async () => {
    mkdirSync("/tmp/test/.sisyphus/drafts", { recursive: true })
    writeFileSync("/tmp/test/.sisyphus/drafts/brainstorm-existing.md", "existing")

    sessionState.updateSessionAgent("ses-brainstormer-5", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer-5", callID: "c5" }
    const output = { args: { filePath: ".sisyphus/drafts/brainstorm-existing.md" } }

    await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
      "Brainstormer may only create new files. Existing file detected",
    )
  })

  test("blocks brainstormer hashline_edit tool", async () => {
    sessionState.updateSessionAgent("ses-brainstormer-6", "brainstormer")
    const input = { tool: "hashline_edit", sessionID: "ses-brainstormer-6", callID: "c6" }
    const output = { args: { filePath: "src/main.ts" } }

    await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
      "Brainstormer can only create new brainstorm/notes/research files",
    )
  })

  test("blocks brainstormer write without file path", async () => {
    sessionState.updateSessionAgent("ses-brainstormer-7", "brainstormer")
    const input = { tool: "Write", sessionID: "ses-brainstormer-7", callID: "c7" }
    const output = { args: { content: "some content" } } // No filePath

    await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
      "Brainstormer can only create new brainstorm/notes/research files",
    )
  })
})