import { describe, it, expect } from "bun:test"
import { createDebuggerAgent } from "./debugger"
import { createBrainstormerAgent } from "./brainstormer"
import { createWriterAgent } from "./writer"
import { createResearcherAgent } from "./researcher"

describe("primary agent subagent wait gate instructions", () => {
  it("#given debugger prompt #when background delegation occurs #then enforces wait before dependent analysis", () => {
    const prompt = createDebuggerAgent("github-copilot/gpt-5.3-codex").prompt

    expect(prompt).toContain("<Anti_Duplication>")
    expect(prompt).toContain("Dependency Gate (MANDATORY)")
    expect(prompt).toContain("background_output(task_id=\"...\")")
    expect(prompt).toContain("Do **not** continue implementation or analysis")
    expect(prompt).toContain("You must wait for Skeptic results before finalizing your hypothesis")
    expect(prompt).toContain("Subagent Mode")
  })

  it("#given brainstormer prompt #when optional checks are delegated #then enforces wait before dependent recommendations", () => {
    const prompt = createBrainstormerAgent("github-copilot/gpt-5.3-codex").prompt

    expect(prompt).toContain("<Anti_Duplication>")
    expect(prompt).toContain("DO NOT perform the same search yourself")
    expect(prompt).toContain("background_output(task_id=\"...\")")
    expect(prompt).toContain("end your response immediately")
  })

  it("#given writer prompt #when research is delegated #then enforces wait before dependent drafting", () => {
    const prompt = createWriterAgent("github-copilot/gpt-5.3-codex").prompt

    expect(prompt).toContain("<Anti_Duplication>")
    expect(prompt).toContain("Subagent dependency gate")
    expect(prompt).toContain("background_output(task_id=\"...\")")
    expect(prompt).toContain("outline scaffolding with explicit TBD placeholders")
  })

  it("#given researcher prompt #when background exploration is delegated #then enforces wait before dependent findings", () => {
    const prompt = createResearcherAgent("github-copilot/gpt-5.3-codex").prompt

    expect(prompt).toContain("<Anti_Duplication>")
    expect(prompt).toContain("Subagent dependency gate")
    expect(prompt).toContain("background_output(task_id=\"...\")")
    expect(prompt).toContain("do not publish dependent findings")
  })
})
