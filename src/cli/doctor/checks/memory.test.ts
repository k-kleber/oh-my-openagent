import { describe, expect, it } from "bun:test"
import { checkMemory } from "./memory"

describe("doctor memory check", () => {
  it("returns pass or warn with memory metrics details", async () => {
    const result = await checkMemory()
    expect(result.name).toBe("Memory")
    expect(["pass", "warn"]).toContain(result.status)
    expect(result.details?.length).toBeGreaterThan(0)
  })
})
