import { describe, expect, test } from "bun:test"
import { getAgentToolRestrictions, hasAgentToolRestrictions } from "./agent-tool-restrictions"

describe("agent-tool-restrictions", () => {
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
    expect(restrictions.serena_delete_memory).toBe(false)
    expect(restrictions.serena_edit_memory).toBe(false)
    expect(restrictions.serena_write_memory).toBe(false)
    expect(restrictions.serena_execute_shell_command).toBe(false)
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
    expect(restrictions.serena_delete_memory).toBe(false)
    expect(restrictions.serena_edit_memory).toBe(false)
    expect(restrictions.serena_write_memory).toBe(false)
    expect(restrictions.serena_execute_shell_command).toBe(false)
  })

  test("brainstormer reports restrictions as present", () => {
    expect(hasAgentToolRestrictions("brainstormer")).toBe(true)
  })
})
