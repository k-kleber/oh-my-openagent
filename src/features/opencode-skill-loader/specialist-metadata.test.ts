/// <reference types="bun-types" />

import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { promises as fs } from "node:fs"
import { loadSkillFromPath } from "./loaded-skill-from-path"

describe("loadSkillFromPath with specialist metadata", () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `specialist-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it("should parse specialist metadata from frontmatter", async () => {
    // given: a skill file with specialist metadata
    const skillPath = join(testDir, "python-expert.md")
    const content = `---
name: python-expert
description: Python specialist
specialist:
  name: python-expert
  baseAgent: sisyphus
  baseCategory: focused
  triggerPhrases: ["help with python", "fix python bug"]
---
Python expertise instructions...
`
    await fs.writeFile(skillPath, content)

    // when: loading the skill
    const result = await loadSkillFromPath({
      skillPath,
      resolvedPath: testDir,
      defaultName: "python-expert",
      scope: "opencode"
    })

    // then: specialist metadata is present on LoadedSkill
    expect(result).not.toBeNull()
    expect(result?.specialist).toBeDefined()
    expect(result?.specialist?.name).toBe("python-expert")
    expect(result?.specialist?.baseAgent).toBe("sisyphus")
    expect(result?.specialist?.baseCategory).toBe("focused")
    expect(result?.specialist?.triggerPhrases).toEqual(["help with python", "fix python bug"])
  })

  it("should handle skills without specialist metadata", async () => {
    // given: a skill file without specialist metadata
    const skillPath = join(testDir, "normal-skill.md")
    const content = `---
name: normal-skill
description: A normal skill
---
Normal instructions...
`
    await fs.writeFile(skillPath, content)

    // when: loading the skill
    const result = await loadSkillFromPath({
      skillPath,
      resolvedPath: testDir,
      defaultName: "normal-skill",
      scope: "opencode"
    })

    // then: specialist metadata is undefined
    expect(result).not.toBeNull()
    expect(result?.specialist).toBeUndefined()
  })
})
