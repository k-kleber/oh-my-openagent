/// <reference types="bun-types" />

import { describe, test, expect, spyOn } from "bun:test"
import { createBuiltinAgents } from "./builtin-agents"
import * as shared from "../shared"

const TEST_DEFAULT_MODEL = "anthropic/claude-opus-4-6"

describe("Caveman Integration", () => {
  test("When cavemanEnabled=false, no Caveman section appears in Sisyphus prompt", async () => {
    // #given
    const fetchSpy = spyOn(shared, "fetchAvailableModels").mockResolvedValue(
      new Set(["anthropic/claude-opus-4-6"])
    )

    try {
      // #when
      const agents = await createBuiltinAgents(
        [],
        {},
        undefined,
        TEST_DEFAULT_MODEL,
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        false,
        false // cavemanEnabled
      )

      // #then
      expect(agents.sisyphus.prompt).not.toContain("<Caveman_Rules>")
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test("When cavemanEnabled=true, Sisyphus (Ultra) receives correct Caveman block", async () => {
    // #given
    const fetchSpy = spyOn(shared, "fetchAvailableModels").mockResolvedValue(
      new Set(["anthropic/claude-opus-4-6"])
    )

    try {
      // #when
      const agents = await createBuiltinAgents(
        [],
        {},
        undefined,
        TEST_DEFAULT_MODEL,
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        false,
        true // cavemanEnabled
      )

      // #then
      expect(agents.sisyphus.prompt).toContain("<Caveman_Rules>")
      expect(agents.sisyphus.prompt).toContain("Grunt Level: ultra")
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test("When cavemanEnabled=true, Explore (Full) receives correct Caveman block", async () => {
    // #given
    const fetchSpy = spyOn(shared, "fetchAvailableModels").mockResolvedValue(
      new Set(["anthropic/claude-opus-4-6", "grok-code-fast-1"])
    )

    try {
      // #when
      const agents = await createBuiltinAgents(
        [],
        {},
        undefined,
        TEST_DEFAULT_MODEL,
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        false,
        true // cavemanEnabled
      )

      // #then
      expect(agents.explore.prompt).toContain("<Caveman_Rules>")
      expect(agents.explore.prompt).toContain("Grunt Level: full")
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test("When cavemanEnabled=true, Hephaestus (Full) receives correct Caveman block", async () => {
     // #given
     const fetchSpy = spyOn(shared, "fetchAvailableModels").mockResolvedValue(
       new Set(["anthropic/claude-opus-4-6", "openai/gpt-5.3-codex"])
     )
 
     try {
       // #when
       const agents = await createBuiltinAgents(
         [],
         {},
         undefined,
         TEST_DEFAULT_MODEL,
         undefined,
         undefined,
         [],
         undefined,
         undefined,
         undefined,
         undefined,
         undefined,
         false,
         false,
         true // cavemanEnabled
       )
 
       // #then
       expect(agents.hephaestus.prompt).toContain("<Caveman_Rules>")
       expect(agents.hephaestus.prompt).toContain("Grunt Level: full")
     } finally {
       fetchSpy.mockRestore()
     }
   })

   test("When cavemanEnabled=true, Tester (Ultra) receives correct Caveman block", async () => {
    // #given
    const fetchSpy = spyOn(shared, "fetchAvailableModels").mockResolvedValue(
      new Set(["anthropic/claude-opus-4-6"])
    )

    try {
      // #when
      const agents = await createBuiltinAgents(
        [],
        {},
        undefined,
        TEST_DEFAULT_MODEL,
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        false,
        true // cavemanEnabled
      )

      // #then
      expect(agents.tester.prompt).toContain("<Caveman_Rules>")
      expect(agents.tester.prompt).toContain("Grunt Level: ultra")
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
