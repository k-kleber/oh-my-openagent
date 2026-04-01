import { describe, expect, test } from "bun:test"
import { getAgentToolRestrictions, hasAgentToolRestrictions } from "./agent-tool-restrictions"

describe("agent-tool-restrictions", () => {
  test("brainstormer blocks write/edit/patch tools", () => {
    const restrictions = getAgentToolRestrictions("brainstormer")

    expect(restrictions.write).toBe(false)
    expect(restrictions.edit).toBe(false)
    expect(restrictions.apply_patch).toBe(false)
    expect(restrictions.hashline_edit).toBe(false)
  })

  test("brainstormer restrictions are case-insensitive", () => {
    const restrictions = getAgentToolRestrictions("Brainstormer")

    expect(restrictions.write).toBe(false)
    expect(restrictions.edit).toBe(false)
    expect(restrictions.apply_patch).toBe(false)
    expect(restrictions.hashline_edit).toBe(false)
  })

  test("brainstormer reports restrictions as present", () => {
    expect(hasAgentToolRestrictions("brainstormer")).toBe(true)
  })
})
