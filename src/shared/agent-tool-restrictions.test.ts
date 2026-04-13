import { describe, expect, test } from "bun:test"
import { getAgentToolRestrictions, hasAgentToolRestrictions } from "./agent-tool-restrictions"

describe("agent-tool-restrictions", () => {
  test("deep-explorer blocks write/edit/task/call_omo_agent like exploration agents", () => {
    const restrictions = getAgentToolRestrictions("deep-explorer")

    expect(restrictions.write).toBe(false)
    expect(restrictions.edit).toBe(false)
    expect(restrictions.task).toBe(false)
    expect(restrictions.call_omo_agent).toBe(false)
  })

  test("deep-explorer reports restrictions as present", () => {
    expect(hasAgentToolRestrictions("deep-explorer")).toBe(true)
  })

  test("graphify-retrieval blocks mutation, delegation, and shell tools", () => {
    const restrictions = getAgentToolRestrictions("graphify-retrieval")

    expect(restrictions.write).toBe(false)
    expect(restrictions.edit).toBe(false)
    expect(restrictions.task).toBe(false)
    expect(restrictions.call_omo_agent).toBe(false)
    expect(restrictions.bash).toBe(false)
  })

  test("graphify-retrieval reports restrictions as present", () => {
    expect(hasAgentToolRestrictions("graphify-retrieval")).toBe(true)
  })

  test("brainstormer allows write but blocks mutation and patch tools", () => {
    const restrictions = getAgentToolRestrictions("brainstormer")

    expect(restrictions.write).toBe(true)
    expect(restrictions.edit).toBe(false)
    expect(restrictions.apply_patch).toBe(false)
    expect(restrictions.hashline_edit).toBe(false)
    expect(restrictions.serena_create_text_file).toBe(false)
    expect(restrictions.serena_replace_content).toBe(false)
    expect(restrictions.serena_replace_symbol_body).toBe(false)
    expect(restrictions.serena_insert_after_symbol).toBe(false)
    expect(restrictions.serena_insert_before_symbol).toBe(false)
    expect(restrictions.serena_rename_symbol).toBe(false)
    expect(restrictions.serena_read_memory).toBe(false)
    expect(restrictions.serena_list_memories).toBe(false)
    expect(restrictions.serena_delete_memory).toBe(false)
    expect(restrictions.serena_edit_memory).toBe(false)
    expect(restrictions.serena_write_memory).toBe(false)
    expect(restrictions.serena_execute_shell_command).toBe(false)
    expect(restrictions.hindsight_retain).toBe(false)
    expect(restrictions.hindsight_create_bank).toBe(false)
    expect(restrictions.openmemory_store).toBe(false)
    expect(restrictions.openmemory_reinforce).toBe(false)
  })

  test("brainstormer restrictions are case-insensitive", () => {
    const restrictions = getAgentToolRestrictions("Brainstormer")

    expect(restrictions.write).toBe(true)
    expect(restrictions.edit).toBe(false)
    expect(restrictions.apply_patch).toBe(false)
    expect(restrictions.hashline_edit).toBe(false)
    expect(restrictions.serena_create_text_file).toBe(false)
    expect(restrictions.serena_replace_content).toBe(false)
    expect(restrictions.serena_replace_symbol_body).toBe(false)
    expect(restrictions.serena_insert_after_symbol).toBe(false)
    expect(restrictions.serena_insert_before_symbol).toBe(false)
    expect(restrictions.serena_rename_symbol).toBe(false)
    expect(restrictions.serena_read_memory).toBe(false)
    expect(restrictions.serena_list_memories).toBe(false)
    expect(restrictions.serena_delete_memory).toBe(false)
    expect(restrictions.serena_edit_memory).toBe(false)
    expect(restrictions.serena_write_memory).toBe(false)
    expect(restrictions.serena_execute_shell_command).toBe(false)
    expect(restrictions.hindsight_retain).toBe(false)
    expect(restrictions.hindsight_create_bank).toBe(false)
    expect(restrictions.openmemory_store).toBe(false)
    expect(restrictions.openmemory_reinforce).toBe(false)
  })

  test("primary agents block native memory mutation tools so they use memory agents instead", () => {
    for (const agentName of ["sisyphus", "hephaestus", "prometheus", "researcher", "writer", "debugger"]) {
      const restrictions = getAgentToolRestrictions(agentName)

      expect(restrictions.serena_read_memory).toBe(false)
      expect(restrictions.serena_list_memories).toBe(false)
      expect(restrictions.serena_delete_memory).toBe(false)
      expect(restrictions.serena_edit_memory).toBe(false)
      expect(restrictions.serena_write_memory).toBe(false)
      expect(restrictions.hindsight_retain).toBe(false)
      expect(restrictions.hindsight_create_bank).toBe(false)
      expect(restrictions.openmemory_store).toBe(false)
      expect(restrictions.openmemory_reinforce).toBe(false)
    }
  })

  test("brainstormer reports restrictions as present", () => {
    expect(hasAgentToolRestrictions("brainstormer")).toBe(true)
  })

  test("tester blocks mutation and delegation tools while keeping shell-only execution posture", () => {
    const restrictions = getAgentToolRestrictions("tester")

    expect(restrictions.write).toBe(false)
    expect(restrictions.edit).toBe(false)
    expect(restrictions.apply_patch).toBe(false)
    expect(restrictions.task).toBe(false)
    expect(restrictions.call_omo_agent).toBe(false)
    expect(restrictions.interactive_bash).toBe(false)
    expect(restrictions.serena_execute_shell_command).toBe(false)
    expect(restrictions.hindsight_retain).toBe(false)
    expect(restrictions.openmemory_store).toBe(false)
  })

  test("tester reports restrictions as present", () => {
    expect(hasAgentToolRestrictions("tester")).toBe(true)
  })
})
