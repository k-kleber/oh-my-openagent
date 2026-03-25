import { describe, test, expect } from "bun:test"
import { createBuiltinSkills } from "./skills"

describe("createBuiltinSkills", () => {
	test("returns playwright skill by default", () => {
		// given - no options (default)

		// when
		const skills = createBuiltinSkills()

		// then
		const browserSkill = skills.find((s) => s.name === "playwright")
		expect(browserSkill).toBeDefined()
		expect(browserSkill!.description).toContain("browser")
		expect(browserSkill!.mcpConfig).toHaveProperty("playwright")
	})

	test("returns playwright skill when browserProvider is 'playwright'", () => {
		// given
		const options = { browserProvider: "playwright" as const }

		// when
		const skills = createBuiltinSkills(options)

		// then
		const playwrightSkill = skills.find((s) => s.name === "playwright")
		const agentBrowserSkill = skills.find((s) => s.name === "agent-browser")
		expect(playwrightSkill).toBeDefined()
		expect(agentBrowserSkill).toBeUndefined()
	})

	test("returns agent-browser skill when browserProvider is 'agent-browser'", () => {
		// given
		const options = { browserProvider: "agent-browser" as const }

		// when
		const skills = createBuiltinSkills(options)

		// then
		const agentBrowserSkill = skills.find((s) => s.name === "agent-browser")
		const playwrightSkill = skills.find((s) => s.name === "playwright")
		expect(agentBrowserSkill).toBeDefined()
		expect(agentBrowserSkill!.description).toContain("browser")
		expect(agentBrowserSkill!.allowedTools).toContain("Bash(agent-browser:*)")
		expect(agentBrowserSkill!.template).toContain("agent-browser")
		expect(playwrightSkill).toBeUndefined()
	})

	test("agent-browser skill template is inlined (not loaded from file)", () => {
		// given
		const options = { browserProvider: "agent-browser" as const }

		// when
		const skills = createBuiltinSkills(options)
		const agentBrowserSkill = skills.find((s) => s.name === "agent-browser")

		// then - template should contain substantial content (inlined, not fallback)
		expect(agentBrowserSkill!.template).toContain("## Quick start")
		expect(agentBrowserSkill!.template).toContain("## Commands")
		expect(agentBrowserSkill!.template).toContain("agent-browser open")
		expect(agentBrowserSkill!.template).toContain("agent-browser snapshot")
	})

	test("always includes frontend-ui-ux and git-master skills", () => {
		// given - both provider options

		// when
		const defaultSkills = createBuiltinSkills()
		const agentBrowserSkills = createBuiltinSkills({ browserProvider: "agent-browser" })

		// then
		for (const skills of [defaultSkills, agentBrowserSkills]) {
			expect(skills.find((s) => s.name === "frontend-ui-ux")).toBeDefined()
			expect(skills.find((s) => s.name === "git-master")).toBeDefined()
		}
	})

	test("returns expected core skills regardless of provider", () => {
		// given

		// when
		const defaultSkills = createBuiltinSkills()
		const agentBrowserSkills = createBuiltinSkills({ browserProvider: "agent-browser" })

		// then
		expect(defaultSkills.length).toBeGreaterThanOrEqual(4)
		expect(agentBrowserSkills.length).toBeGreaterThanOrEqual(4)
		expect(defaultSkills.map((s) => s.name)).toContain("context7-mcp")
		expect(defaultSkills.map((s) => s.name)).toContain("websearch-mcp")
	})

		test("should exclude playwright when it is in disabledSkills", () => {
			// #given
			const options = { disabledSkills: new Set(["playwright"]) }

		// #when
		const skills = createBuiltinSkills(options)

			// #then
			expect(skills.map((s) => s.name)).not.toContain("playwright")
			expect(skills.map((s) => s.name)).toContain("frontend-ui-ux")
			expect(skills.map((s) => s.name)).toContain("git-master")
			expect(skills.map((s) => s.name)).toContain("dev-browser")
			expect(skills.length).toBeGreaterThan(3)
		})

		test("should exclude multiple skills when they are in disabledSkills", () => {
			// #given
			const options = { disabledSkills: new Set(["playwright", "git-master"]) }

		// #when
		const skills = createBuiltinSkills(options)

			// #then
			expect(skills.map((s) => s.name)).not.toContain("playwright")
			expect(skills.map((s) => s.name)).not.toContain("git-master")
			expect(skills.map((s) => s.name)).toContain("frontend-ui-ux")
			expect(skills.map((s) => s.name)).toContain("dev-browser")
			expect(skills.length).toBeGreaterThan(2)
		})

		test("should return an empty array when all skills are disabled", () => {
			// #given
			const options = {
				disabledSkills: new Set(createBuiltinSkills().map((skill) => skill.name)),
			}

		// #when
		const skills = createBuiltinSkills(options)

		// #then
		expect(skills.length).toBe(0)
	})

	test("should return all skills when disabledSkills set is empty", () => {
		// #given
		const options = { disabledSkills: new Set<string>() }

		// #when
		const skills = createBuiltinSkills(options)

		// #then
		expect(skills.length).toBeGreaterThanOrEqual(4)
	})

	test("uses tavily MCP config when websearch provider is tavily", () => {
		const skills = createBuiltinSkills({ websearchConfig: { provider: "tavily" } })
		const websearchSkill = skills.find((s) => s.name === "websearch-mcp")

		expect(websearchSkill).toBeDefined()
		expect(websearchSkill!.mcpConfig).toBeDefined()
		expect(websearchSkill!.mcpConfig!.websearch.url).toBe("https://mcp.tavily.com/mcp/")
	})

	test("returns playwright-cli skill when browserProvider is 'playwright-cli'", () => {
		// given
		const options = { browserProvider: "playwright-cli" as const }

		// when
		const skills = createBuiltinSkills(options)

		// then
		const playwrightSkill = skills.find((s) => s.name === "playwright")
		const agentBrowserSkill = skills.find((s) => s.name === "agent-browser")
		expect(playwrightSkill).toBeDefined()
		expect(playwrightSkill!.description).toContain("browser")
		expect(playwrightSkill!.allowedTools).toContain("Bash(playwright-cli:*)")
		expect(playwrightSkill!.mcpConfig).toBeUndefined()
		expect(agentBrowserSkill).toBeUndefined()
	})

	test("playwright-cli skill template contains CLI commands", () => {
		// given
		const options = { browserProvider: "playwright-cli" as const }

		// when
		const skills = createBuiltinSkills(options)
		const skill = skills.find((s) => s.name === "playwright")

		// then
		expect(skill!.template).toContain("playwright-cli open")
		expect(skill!.template).toContain("playwright-cli snapshot")
		expect(skill!.template).toContain("playwright-cli click")
	})
})
