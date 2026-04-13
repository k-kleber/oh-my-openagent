/// <reference types="bun-types" />

import { describe, it, expect } from "bun:test"
import {
  buildCategorySkillsDelegationGuide,
  buildUltraworkSection,
  buildParallelDelegationSection,
  buildNonClaudePlannerSection,
  buildExploreSection,
  buildGraphifySection,
  getCavemanTierForAgent,
  buildCavemanSection,
  maybeBuildCavemanSection,
  type AvailableSkill,
  type AvailableCategory,
  type AvailableAgent,
} from "./dynamic-agent-prompt-builder"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

describe("buildCategorySkillsDelegationGuide", () => {
  const categories: AvailableCategory[] = [
    { name: "visual-engineering", description: "Frontend, UI/UX" },
    { name: "quick", description: "Trivial tasks" },
  ]

  const builtinSkills: AvailableSkill[] = [
    { name: "playwright", description: "Browser automation via Playwright", location: "plugin" },
    { name: "frontend-ui-ux", description: "Designer-turned-developer", location: "plugin" },
  ]

  const customUserSkills: AvailableSkill[] = [
    { name: "react-19", description: "React 19 patterns and best practices", location: "user" },
    { name: "tailwind-4", description: "Tailwind CSS v4 utilities", location: "user" },
  ]

  const customProjectSkills: AvailableSkill[] = [
    { name: "our-design-system", description: "Internal design system components", location: "project" },
  ]

  it("should list builtin and custom skills in compact format", () => {
    //#given: mix of builtin and custom skills
    const allSkills = [...builtinSkills, ...customUserSkills]

    //#when: building the delegation guide
    const result = buildCategorySkillsDelegationGuide(categories, allSkills)

    //#then: should use compact format with both sections
    expect(result).toContain("**Built-in**: playwright, frontend-ui-ux")
    expect(result).toContain("YOUR SKILLS (PRIORITY)")
    expect(result).toContain("react-19 (user)")
    expect(result).toContain("tailwind-4 (user)")
  })

  it("should point to skill tool as source of truth", () => {
    //#given: skills present
    const allSkills = [...builtinSkills, ...customUserSkills]

    //#when: building the delegation guide
    const result = buildCategorySkillsDelegationGuide(categories, allSkills)

    //#then: should reference the skill tool for full descriptions
    expect(result).toContain("`skill` tool")
  })

  it("should show source tags for custom skills (user vs project)", () => {
    //#given: both user and project custom skills
    const allSkills = [...builtinSkills, ...customUserSkills, ...customProjectSkills]

    //#when: building the delegation guide
    const result = buildCategorySkillsDelegationGuide(categories, allSkills)

    //#then: should show source tag for each custom skill
    expect(result).toContain("(user)")
    expect(result).toContain("(project)")
  })

  it("should not show custom skill section when only builtin skills exist", () => {
    //#given: only builtin skills
    const allSkills = [...builtinSkills]

    //#when: building the delegation guide
    const result = buildCategorySkillsDelegationGuide(categories, allSkills)

    //#then: should not contain custom skill emphasis
    expect(result).not.toContain("YOUR SKILLS")
    expect(result).toContain("**Built-in**:")
    expect(result).toContain("Available Skills")
  })

  it("should handle only custom skills (no builtins)", () => {
    //#given: only custom skills, no builtins
    const allSkills = [...customUserSkills]

    //#when: building the delegation guide
    const result = buildCategorySkillsDelegationGuide(categories, allSkills)

    //#then: should show custom skills with emphasis, no builtin line
    expect(result).toContain("YOUR SKILLS (PRIORITY)")
    expect(result).not.toContain("**Built-in**:")
  })

  it("should include priority note for custom skills in evaluation step", () => {
    //#given: custom skills present
    const allSkills = [...builtinSkills, ...customUserSkills]

    //#when: building the delegation guide
    const result = buildCategorySkillsDelegationGuide(categories, allSkills)

    //#then: evaluation section should mention user-installed priority
    expect(result).toContain("User-installed skills get PRIORITY")
    expect(result).toContain("INCLUDE rather than omit")
  })

  it("should NOT include priority note when no custom skills", () => {
    //#given: only builtin skills
    const allSkills = [...builtinSkills]

    //#when: building the delegation guide
    const result = buildCategorySkillsDelegationGuide(categories, allSkills)

    //#then: no priority note for custom skills
    expect(result).not.toContain("User-installed skills get PRIORITY")
  })

  it("should return empty string when no categories and no skills", () => {
    //#given: no categories and no skills
    //#when: building the delegation guide
    const result = buildCategorySkillsDelegationGuide([], [])

    //#then: should return empty string
    expect(result).toBe("")
  })

  it("should include category descriptions", () => {
    //#given: categories with descriptions
    const allSkills = [...builtinSkills]

    //#when: building the delegation guide
    const result = buildCategorySkillsDelegationGuide(categories, allSkills)

    //#then: should list categories with their descriptions
    expect(result).toContain("`visual-engineering`")
    expect(result).toContain("Frontend, UI/UX")
    expect(result).toContain("`quick`")
    expect(result).toContain("Trivial tasks")
  })
})

describe("buildGraphifySection", () => {
  it("returns empty string when graphify artifacts are absent", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "graphify-miss-"))

    const result = buildGraphifySection(tempDir)

    expect(result).toBe("")
  })

  it("returns graphify-retrieval guidance when graphify-out exists", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "graphify-hit-"))
    const graphifyDir = join(tempDir, "graphify-out")
    mkdirSync(graphifyDir)
    writeFileSync(join(graphifyDir, "graph.json"), "{}")

    const result = buildGraphifySection(tempDir)

    expect(result).toContain('task(subagent_type="graphify-retrieval"')
    expect(result).toContain("before explore")
    expect(result).toContain("Wait for the `graphify-retrieval` result")
    expect(result).toContain("Do not glob/read Graphify artifacts yourself")
    expect(result).not.toContain('skill("graphify")')
    expect(result).not.toContain("If `task` is unavailable")
  })

  it("supports explicit non-task fallback guidance when requested", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "graphify-notask-"))
    const graphifyDir = join(tempDir, "graphify-out")
    mkdirSync(graphifyDir)
    writeFileSync(join(graphifyDir, "graph.json"), "{}")

    const result = buildGraphifySection(tempDir, { requiresTask: false })

    expect(result).toContain("If `task` is unavailable, read `graphify-out/GRAPH_REPORT.md` first")
    expect(result).not.toContain("Wait for the `graphify-retrieval` result")
  })
})

describe("buildUltraworkSection", () => {
  const agents: AvailableAgent[] = []

  it("should separate builtin and custom skills", () => {
    //#given: mix of builtin and custom skills
    const skills: AvailableSkill[] = [
      { name: "playwright", description: "Browser automation", location: "plugin" },
      { name: "react-19", description: "React 19 patterns", location: "user" },
    ]

    //#when: building ultrawork section
    const result = buildUltraworkSection(agents, [], skills)

    //#then: should have separate sections
    expect(result).toContain("Built-in Skills")
    expect(result).toContain("User-Installed Skills")
    expect(result).toContain("HIGH PRIORITY")
  })

  it("should not separate when only builtin skills", () => {
    //#given: only builtin skills
    const skills: AvailableSkill[] = [
      { name: "playwright", description: "Browser automation", location: "plugin" },
    ]

    //#when: building ultrawork section
    const result = buildUltraworkSection(agents, [], skills)

    //#then: should have single section
    expect(result).toContain("Built-in Skills")
    expect(result).not.toContain("User-Installed Skills")
  })
})

describe("buildParallelDelegationSection", () => {
  const deepCategory: AvailableCategory = { name: "deep", description: "Autonomous problem-solving" }
  const unspecifiedHighCategory: AvailableCategory = { name: "unspecified-high", description: "High effort tasks" }
  const otherCategory: AvailableCategory = { name: "quick", description: "Trivial tasks" }

  it("#given non-Claude model with deep category #when building #then returns aggressive delegation section", () => {
    //#given
    const model = "google/gemini-3.1-pro"
    const categories = [deepCategory, otherCategory]

    //#when
    const result = buildParallelDelegationSection(model, categories)

    //#then
    expect(result).toContain("DECOMPOSE AND DELEGATE")
    expect(result).toContain("NOT AN IMPLEMENTER")
    expect(result).toContain("run_in_background=true")
    expect(result).toContain("4 independent units")
    expect(result).toContain("NEVER implement directly")
  })

  it("#given non-Claude model with unspecified-high category #when building #then returns aggressive delegation section", () => {
    //#given
    const model = "openai/gpt-5.4"
    const categories = [unspecifiedHighCategory, otherCategory]

    //#when
    const result = buildParallelDelegationSection(model, categories)

    //#then
    expect(result).toContain("DECOMPOSE AND DELEGATE")
    expect(result).toContain("`deep` or `unspecified-high`")
    expect(result).toContain("NEVER work sequentially")
  })

  it("#given Claude model #when building #then returns empty", () => {
    //#given
    const model = "anthropic/claude-opus-4-6"
    const categories = [deepCategory]

    //#when
    const result = buildParallelDelegationSection(model, categories)

    //#then
    expect(result).toBe("")
  })

  it("#given non-Claude model without deep or unspecified-high category #when building #then returns empty", () => {
    //#given
    const model = "openai/gpt-5.4"
    const categories = [otherCategory]

    //#when
    const result = buildParallelDelegationSection(model, categories)

    //#then
    expect(result).toBe("")
  })
})

describe("buildNonClaudePlannerSection", () => {
  it("#given non-Claude model #when building #then returns plan agent section", () => {
    //#given
    const model = "google/gemini-3.1-pro"

    //#when
    const result = buildNonClaudePlannerSection(model)

    //#then
    expect(result).toContain("Plan Agent")
    expect(result).toContain("session_id")
    expect(result).toContain("Multi-step")
  })

  it("#given Claude model #when building #then returns empty", () => {
    //#given
    const model = "anthropic/claude-sonnet-4-6"

    //#when
    const result = buildNonClaudePlannerSection(model)

    //#then
    expect(result).toBe("")
  })

  it("#given GPT model #when building #then returns plan agent section", () => {
    //#given
    const model = "openai/gpt-5.4"

    //#when
    const result = buildNonClaudePlannerSection(model)

    //#then
    expect(result).toContain("Plan Agent")
    expect(result).not.toBe("")
  })
})

describe("buildExploreSection", () => {
  it("includes explore/deep-explorer chooser guidance when both are available", () => {
    const agents: AvailableAgent[] = [
      {
        name: "explore",
        description: "Explore",
        metadata: {
          category: "exploration",
          cost: "FREE",
          triggers: [],
          useWhen: ["Focused lookup"],
          avoidWhen: ["Known file"],
        },
      },
      {
        name: "deep-explorer",
        description: "Deep Explorer",
        metadata: {
          category: "exploration",
          cost: "CHEAP",
          triggers: [],
          useWhen: ["Cross-module fan-out"],
          avoidWhen: ["Trivial lookup"],
        },
      },
    ]

    const result = buildExploreSection(agents)
    expect(result).toContain("Explore Agents = Contextual Grep Cascade")
    expect(result).toContain("Use `explore` for smaller scoped discovery")
    expect(result).toContain("Use `deep-explorer` when scope is broad/uncertain")
    expect(result).toContain("deep-explorer may spawn `explore` only")
  })
})

describe("Caveman helpers", () => {
  describe("getCavemanTierForAgent", () => {
    it("returns correct tier for lite agents", () => {
      expect(getCavemanTierForAgent("sisyphus")).toBe("lite")
      expect(getCavemanTierForAgent("brainstormer")).toBe("lite")
      expect(getCavemanTierForAgent("atlas")).toBe("lite")
    })

    it("returns correct tier for full agents", () => {
      expect(getCavemanTierForAgent("explore")).toBe("full")
      expect(getCavemanTierForAgent("librarian")).toBe("full")
      expect(getCavemanTierForAgent("oracle")).toBe("full")
    })

    it("returns correct tier for ultra agents", () => {
      expect(getCavemanTierForAgent("sisyphus-junior")).toBe("ultra")
      expect(getCavemanTierForAgent("tester")).toBe("ultra")
    })

    it("returns null for unmapped agents", () => {
      expect(getCavemanTierForAgent("unknown-agent")).toBeNull()
    })
  })

  describe("buildCavemanSection", () => {
    it("returns correct verbatim block for lite tier", () => {
      const result = buildCavemanSection("lite")
      expect(result).toContain("## Grunt Level: lite")
      expect(result).toContain("No filler/hedging. Keep articles + full sentences. Professional but tight")
      expect(result).toContain("Your component re-renders because you create a new object reference each render. Inline object props fail shallow comparison every time. Wrap it in useMemo.")
    })

    it("returns correct verbatim block for full tier", () => {
      const result = buildCavemanSection("full")
      expect(result).toContain("## Grunt Level: full")
      expect(result).toContain("Drop articles, fragments OK, short synonyms. Classic caveman")
      expect(result).toContain("New object ref each render. Inline object prop = new ref = re-render. Wrap in useMemo.")
    })

    it("returns correct verbatim block for ultra tier", () => {
      const result = buildCavemanSection("ultra")
      expect(result).toContain("## Grunt Level: ultra")
      expect(result).toContain("Abbreviate (DB/auth/config/req/res/fn/impl), strip conjunctions, arrows for causality (X → Y), one word when one word enough")
      expect(result).toContain("Inline obj prop → new ref → re-render. useMemo.")
    })
  })

  describe("maybeBuildCavemanSection", () => {
    it("returns empty when disabled", () => {
      expect(maybeBuildCavemanSection("sisyphus", false)).toBe("")
    })

    it("returns empty when agent not mapped", () => {
      expect(maybeBuildCavemanSection("unknown-agent", true)).toBe("")
    })

    it("returns tier block when enabled and agent is mapped", () => {
      const result = maybeBuildCavemanSection("sisyphus", true)
      expect(result).toContain("## Grunt Level: lite")
    })
  })
})
