import { describe, expect, it } from "bun:test"
import { validateSpecialistCollisions } from "./specialist-validation"
import type { LoadedSkill } from "./types"

describe("specialist collision validation", () => {
  const mockSkill = (name: string, specialist: any = {}): LoadedSkill => ({
    name,
    definition: {
      description: "mock",
      tools: [],
      execute: async () => {},
    },
    scope: "project",
    specialist,
  } as LoadedSkill)

  it("should fail when specialist name collides with a reserved name", () => {
    const skills = [
      mockSkill("skill1", { name: "explore" })
    ]
    expect(() => validateSpecialistCollisions(skills)).toThrow(/collides with a reserved built-in category or agent name/)
  })

  it("should fail when specialist alias collides with a reserved name", () => {
    const skills = [
      mockSkill("skill1", { aliases: ["deep"] })
    ]
    expect(() => validateSpecialistCollisions(skills)).toThrow(/collides with a reserved built-in category or agent name/)
  })

  it("should fail when two specialists have the same name", () => {
    const skills = [
      mockSkill("skill1", { name: "expert" }),
      mockSkill("skill2", { name: "expert" })
    ]
    expect(() => validateSpecialistCollisions(skills)).toThrow(/collides with an alias or name already defined/)
  })

  it("should fail when specialist alias collides with another specialist name", () => {
    const skills = [
      mockSkill("skill1", { name: "python-expert" }),
      mockSkill("skill2", { aliases: ["python-expert"] })
    ]
    expect(() => validateSpecialistCollisions(skills)).toThrow(/collides with an alias or name already defined/)
  })

  it("should fail when specialist aliases collide across different skills", () => {
    const skills = [
      mockSkill("skill1", { aliases: ["foo"] }),
      mockSkill("skill2", { aliases: ["foo"] })
    ]
    expect(() => validateSpecialistCollisions(skills)).toThrow(/collides with an alias or name already defined/)
  })

  it("should pass when there are no collisions", () => {
    const skills = [
      mockSkill("skill1", { name: "expert1", aliases: ["alias1"] }),
      mockSkill("skill2", { name: "expert2", aliases: ["alias2"] })
    ]
    expect(() => validateSpecialistCollisions(skills)).not.toThrow()
  })

  it("should pass when specialists are not defined", () => {
    const skills = [
      mockSkill("skill1", undefined),
      mockSkill("skill2", {})
    ]
    expect(() => validateSpecialistCollisions(skills)).not.toThrow()
  })
})
