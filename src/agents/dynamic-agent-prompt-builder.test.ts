/// <reference types="bun-types" />

import { describe, it, expect } from "bun:test"
import {
  buildCategorySkillsDelegationGuide,
  buildUltraworkSection,
  buildParallelDelegationSection,
  buildNonClaudePlannerSection,
  buildExploreSection,
  buildGraphifySection,
  buildDiscoveryLayer,
  type AvailableSkill,
  type AvailableCategory,
  type AvailableAgent,
  type DiscoveryLayerOptions,
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

  it("returns Set B (Tactical Navigation) guidance when graph exists — delegates to buildDiscoveryLayer(hephaestus)", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "graphify-hit-"))
    const graphifyDir = join(tempDir, "graphify-out")
    mkdirSync(graphifyDir)
    writeFileSync(join(graphifyDir, "graph.json"), "{}")

    const result = buildGraphifySection(tempDir)

    // Should contain Set B (Tactical Navigation) content
    expect(result).toContain("Set B: Tactical Navigation")
    expect(result).toContain("`shortest_path`")
    expect(result).toContain("`get_node`")
    expect(result).toContain("`get_neighbors`")
    expect(result).toContain("Map → Microscope → Trace")
    // Hephaestus gets quick-lookup exception
    expect(result).toContain("Hephaestus quick-lookup exception")
    // Should NOT contain old graphify-retrieval subagent instructions
    expect(result).not.toContain('task(subagent_type="graphify-retrieval"')
    expect(result).not.toContain("Wait for the `graphify-retrieval` result")
    expect(result).not.toContain("Do not glob/read Graphify artifacts yourself")
    expect(result).not.toContain("before explore")
    expect(result).not.toContain('skill("graphify")')
  })

  it("returns Set B guidance even when requiresTask is false — buildDiscoveryLayer handles options", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "graphify-notask-"))
    const graphifyDir = join(tempDir, "graphify-out")
    mkdirSync(graphifyDir)
    writeFileSync(join(graphifyDir, "graph.json"), "{}")

    const result = buildGraphifySection(tempDir, { requiresTask: false })

    // Still produces Set B content (requiresTask is passed through but buildDiscoveryLayer
    // produces the same content regardless — old "If task is unavailable" text is gone)
    expect(result).toContain("Set B: Tactical Navigation")
    expect(result).toContain("`shortest_path`")
    expect(result).not.toContain('task(subagent_type="graphify-retrieval"')
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

describe("buildDiscoveryLayer", () => {
  describe("utility agents", () => {
    const utilityAgents = [
      "memory-retrieval",
      "memory-store",
      "librarian",
      "multimodal-looker",
      "momus",
      "metis",
      "atlas",
      "flash",
      "tester",
    ]

    for (const agentName of utilityAgents) {
      it(`returns empty string for ${agentName}`, () => {
        const result = buildDiscoveryLayer(agentName)
        expect(result).toBe("")
      })
    }
  })

  describe("Set A agents (Macro-Survey)", () => {
    const setAAgents = ["sisyphus", "prometheus", "sisyphus-junior"]

    for (const agentName of setAAgents) {
      it(`returns Set A guidance for ${agentName} when graph present`, () => {
        const tempDir = mkdtempSync(join(tmpdir(), "discovery-set-a-"))
        const graphifyDir = join(tempDir, "graphify-out")
        mkdirSync(graphifyDir)
        writeFileSync(join(graphifyDir, "graph.json"), "{}")

        const result = buildDiscoveryLayer(agentName, tempDir)

        expect(result).toContain("Set A: Macro-Survey")
        expect(result).toContain("`query_graph`")
        expect(result).toContain("`god_nodes`")
        expect(result).toContain("`graph_stats`")
        expect(result).toContain("`get_community`")
        expect(result).toContain("Map → Microscope → Trace")
      })

      it(`returns Serena-only fallback for ${agentName} when graph absent`, () => {
        const result = buildDiscoveryLayer(agentName)
        expect(result).toContain("Discovery Layer (Serena — Read-Only Navigation)")
        expect(result).toContain("`serena_activate_project`")
        expect(result).toContain("serena_get_symbols_overview")
        expect(result).not.toContain("graphify-retrieval")
      })
    }
  })

  describe("Set B agents (Tactical Navigation)", () => {
    const setBAgents = ["hephaestus", "oracle", "debugger", "brainstormer"]

    for (const agentName of setBAgents) {
      it(`returns Set B guidance for ${agentName} when graph present`, () => {
        const tempDir = mkdtempSync(join(tmpdir(), "discovery-set-b-"))
        const graphifyDir = join(tempDir, "graphify-out")
        mkdirSync(graphifyDir)
        writeFileSync(join(graphifyDir, "graph.json"), "{}")

        const result = buildDiscoveryLayer(agentName, tempDir)

        expect(result).toContain("Set B: Tactical Navigation")
        expect(result).toContain("`shortest_path`")
        expect(result).toContain("`get_node`")
        expect(result).toContain("`get_neighbors`")
        expect(result).toContain("Map → Microscope → Trace")
      })

      it(`returns Serena-only fallback for ${agentName} when graph absent`, () => {
        const result = buildDiscoveryLayer(agentName)
        expect(result).toContain("Discovery Layer (Serena — Read-Only Navigation)")
        expect(result).toContain("`serena_activate_project`")
        expect(result).toContain("serena_get_symbols_overview")
      })
    }
  })

  describe("Set C agents (Impact Check)", () => {
    const setCAgents = ["explore", "deep-explorer"]

    for (const agentName of setCAgents) {
      it(`returns Set C guidance for ${agentName} when graph present`, () => {
        const tempDir = mkdtempSync(join(tmpdir(), "discovery-set-c-"))
        const graphifyDir = join(tempDir, "graphify-out")
        mkdirSync(graphifyDir)
        writeFileSync(join(graphifyDir, "graph.json"), "{}")

        const result = buildDiscoveryLayer(agentName, tempDir)

        expect(result).toContain("Set C: Impact Check")
        expect(result).toContain("`get_neighbors`")
        expect(result).toContain("`shortest_path`")
        expect(result).toContain("Map → Microscope → Trace")
      })

      it(`returns Serena-only fallback for ${agentName} when graph absent`, () => {
        const result = buildDiscoveryLayer(agentName)
        expect(result).toContain("Discovery Layer (Serena — Read-Only Navigation)")
        expect(result).toContain("`serena_activate_project`")
        expect(result).toContain("serena_get_symbols_overview")
      })
    }
  })

  describe("role-based injection", () => {
    it("includes hybrid search rule for prometheus", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "discovery-prometheus-"))
      const graphifyDir = join(tempDir, "graphify-out")
      mkdirSync(graphifyDir)
      writeFileSync(join(graphifyDir, "graph.json"), "{}")

      const result = buildDiscoveryLayer("prometheus", tempDir)

      expect(result).toContain("Prometheus quick-lookup exception")
    })

    it("includes hybrid search rule for hephaestus", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "discovery-hephaestus-"))
      const graphifyDir = join(tempDir, "graphify-out")
      mkdirSync(graphifyDir)
      writeFileSync(join(graphifyDir, "graph.json"), "{}")

      const result = buildDiscoveryLayer("hephaestus", tempDir)

      expect(result).toContain("Hephaestus quick-lookup exception")
    })

    it("does NOT include hybrid search exception for sisyphus (non-quick-lookup agent)", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "discovery-sisyphus-"))
      const graphifyDir = join(tempDir, "graphify-out")
      mkdirSync(graphifyDir)
      writeFileSync(join(graphifyDir, "graph.json"), "{}")

      const result = buildDiscoveryLayer("sisyphus", tempDir)

      expect(result).not.toContain("quick-lookup exception")
      expect(result).toContain("Heavy or broad search MUST delegate")
    })
  })

  describe("graph absence fallback", () => {
    it("returns Serena-only fallback when directory is undefined", () => {
      const result = buildDiscoveryLayer("sisyphus")

      expect(result).toContain("Discovery Layer (Serena — Read-Only Navigation)")
      expect(result).not.toContain("graphify-retrieval")
    })

    it("returns Serena-only fallback when graph.json is absent", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "discovery-nograph-"))

      const result = buildDiscoveryLayer("oracle", tempDir)

      expect(result).toContain("Discovery Layer (Serena — Read-Only Navigation)")
      expect(result).toContain("`serena_activate_project`")
      expect(result).toContain("`serena_get_symbols_overview`")
      expect(result).not.toContain("graphify-retrieval")
    })

    it("does NOT instruct to invoke graphify-retrieval in fallback", () => {
      const result = buildDiscoveryLayer("explore")

      expect(result).not.toContain("graphify-retrieval")
      expect(result).not.toContain('task(subagent_type="graphify-retrieval"')
    })
  })

  describe("Serena read-only wording", () => {
    it("explicitly marks Serena tools as read-only in Set A", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "discovery-readonly-a-"))
      const graphifyDir = join(tempDir, "graphify-out")
      mkdirSync(graphifyDir)
      writeFileSync(join(graphifyDir, "graph.json"), "{}")

      const result = buildDiscoveryLayer("prometheus", tempDir)

      expect(result).toContain("Read-only navigation and verification only")
      expect(result).not.toContain("replace_symbol_body")
      expect(result).not.toContain("insert_after_symbol")
      expect(result).not.toContain("insert_before_symbol")
      expect(result).not.toContain("rename_symbol")
    })

    it("explicitly marks Serena tools as read-only in Set B", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "discovery-readonly-b-"))
      const graphifyDir = join(tempDir, "graphify-out")
      mkdirSync(graphifyDir)
      writeFileSync(join(graphifyDir, "graph.json"), "{}")

      const result = buildDiscoveryLayer("oracle", tempDir)

      expect(result).toContain("Read-only navigation and verification only")
      expect(result).not.toContain("replace_symbol_body")
      expect(result).not.toContain("insert_after_symbol")
      expect(result).not.toContain("insert_before_symbol")
      expect(result).not.toContain("rename_symbol")
    })

    it("explicitly marks Serena tools as read-only in Set C", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "discovery-readonly-c-"))
      const graphifyDir = join(tempDir, "graphify-out")
      mkdirSync(graphifyDir)
      writeFileSync(join(graphifyDir, "graph.json"), "{}")

      const result = buildDiscoveryLayer("deep-explorer", tempDir)

      expect(result).toContain("Read-only navigation and verification only")
      expect(result).not.toContain("replace_symbol_body")
      expect(result).not.toContain("insert_after_symbol")
      expect(result).not.toContain("insert_before_symbol")
      expect(result).not.toContain("rename_symbol")
    })

    it("explicitly marks Serena tools as read-only in fallback", () => {
      const result = buildDiscoveryLayer("sisyphus")

      expect(result).toContain("Read-only navigation and verification only")
      expect(result).not.toContain("replace_symbol_body")
      expect(result).not.toContain("insert_after_symbol")
      expect(result).not.toContain("insert_before_symbol")
      expect(result).not.toContain("rename_symbol")
    })
  })

  describe("graph present vs absent differentiation", () => {
    it("returns full guidance with Graphify tools when graph present", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "discovery-full-"))
      const graphifyDir = join(tempDir, "graphify-out")
      mkdirSync(graphifyDir)
      writeFileSync(join(graphifyDir, "graph.json"), "{}")

      const result = buildDiscoveryLayer("sisyphus", tempDir)

      expect(result).toContain("Graphify")
      expect(result).toContain("query_graph")
      expect(result).toContain("god_nodes")
    })

    it("returns minimal Serena-only fallback when graph absent", () => {
      const result = buildDiscoveryLayer("sisyphus")

      expect(result).toContain("Serena — Read-Only Navigation")
      expect(result).not.toContain("query_graph")
      expect(result).not.toContain("god_nodes")
      expect(result).not.toContain("Graphify + Serena")
    })
  })

  describe("options", () => {
    it("accepts DiscoveryLayerOptions interface", () => {
      const tempDir = mkdtempSync(join(tmpdir(), "discovery-options-"))
      const graphifyDir = join(tempDir, "graphify-out")
      mkdirSync(graphifyDir)
      writeFileSync(join(graphifyDir, "graph.json"), "{}")

      const options: DiscoveryLayerOptions = { requiresTask: false }
      const result = buildDiscoveryLayer("sisyphus", tempDir, options)

      expect(result).toContain("Set A: Macro-Survey")
    })
  })
})

