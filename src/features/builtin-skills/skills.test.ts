import { afterEach, describe, test, expect } from "bun:test"
import { createBuiltinSkills } from "./skills"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const originalTavily = process.env.TAVILY_API_KEY

function resetTavilyEnv() {
  if (typeof originalTavily === "undefined") {
    delete process.env.TAVILY_API_KEY
    return
  }
  process.env.TAVILY_API_KEY = originalTavily
}

function withTavilyEnv(value: string | undefined, run: () => void) {
	const previous = process.env.TAVILY_API_KEY
	if (typeof value === "undefined") {
		delete process.env.TAVILY_API_KEY
	} else {
		process.env.TAVILY_API_KEY = value
	}

	try {
		run()
	} finally {
		if (typeof previous === "undefined") {
			delete process.env.TAVILY_API_KEY
		} else {
			process.env.TAVILY_API_KEY = previous
		}
	}
}

afterEach(() => {
	resetTavilyEnv()
})

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
		expect(defaultSkills.map((s) => s.name)).toContain("code-intelligence-init")
	})

	test("memory-init template includes code-intelligence handoff guidance", () => {
		const skills = createBuiltinSkills()
		const memoryInit = skills.find((s) => s.name === "memory-init")

		expect(memoryInit).toBeDefined()
		expect(memoryInit!.template).toContain("Verify code-intelligence readiness")
		expect(memoryInit!.template).toContain("code-intelligence-init")
		expect(memoryInit!.mcpConfig).toBeDefined()
		expect(memoryInit!.mcpConfig).toHaveProperty("fastcode")
	})

	test("should include memory automation skill set in builtin skills", () => {
		const skills = createBuiltinSkills()
		const names = new Set(skills.map((s) => s.name))

		expect(names.has("memory-mcp")).toBe(true)
		expect(names.has("memory-capture")).toBe(true)
		expect(names.has("memory-recall-and-verify")).toBe(true)
		expect(names.has("memory-auto")).toBe(true)
		expect(names.has("memory-init")).toBe(true)
		expect(names.has("memory-promote")).toBe(true)
		expect(names.has("memory-pre-compaction")).toBe(true)
		expect(names.has("memory-observation-ledger")).toBe(true)
	})

	test("code-intelligence-init template includes FastCode API/CLI fallback", () => {
		const skills = createBuiltinSkills()
		const initSkill = skills.find((s) => s.name === "code-intelligence-init")

		expect(initSkill).toBeDefined()
		expect(initSkill!.template).toContain("api.py --host 0.0.0.0 --port 8000")
		expect(initSkill!.template).toContain("/load-and-index")
		expect(initSkill!.template).toContain("main.py index --repo-path .")
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
		expect(websearchSkill!.template).toContain("Preferred tool name: `tavily_search`")
	})

	test("uses exa tool-name guidance when provider is exa", () => {
		const skills = createBuiltinSkills({ websearchConfig: { provider: "exa" } })
		const websearchSkill = skills.find((s) => s.name === "websearch-mcp")

		expect(websearchSkill).toBeDefined()
		expect(websearchSkill!.template).toContain("Preferred tool name: `web_search_exa`")
	})

	test("does not double-prefix Bearer for tavily api key", () => {
		withTavilyEnv("Bearer tavily-token", () => {
			const skills = createBuiltinSkills({ websearchConfig: { provider: "tavily" } })
			const websearchSkill = skills.find((s) => s.name === "websearch-mcp")

			expect(websearchSkill).toBeDefined()
			expect(websearchSkill!.mcpConfig!.websearch.headers).toEqual({ Authorization: "Bearer tavily-token" })
		})
	})

	test("adds Bearer prefix for raw tavily api key", () => {
		withTavilyEnv("tavily-token", () => {
			const skills = createBuiltinSkills({ websearchConfig: { provider: "tavily" } })
			const websearchSkill = skills.find((s) => s.name === "websearch-mcp")

			expect(websearchSkill).toBeDefined()
			expect(websearchSkill!.mcpConfig!.websearch.headers).toEqual({ Authorization: "Bearer tavily-token" })
		})
	})

	test("reads tavily api key from project .secrets when env is absent", () => {
		const dir = mkdtempSync(join(tmpdir(), "omo-websearch-"))
		const previousCwd = process.cwd()
		delete process.env.TAVILY_API_KEY
		writeFileSync(join(dir, ".secrets"), "TAVILY_API_KEY=test-from-secrets\n")

		process.chdir(dir)
		try {
			const skills = createBuiltinSkills({ websearchConfig: { provider: "tavily" } })
			const websearchSkill = skills.find((s) => s.name === "websearch-mcp")

			expect(websearchSkill).toBeDefined()
			expect(websearchSkill!.mcpConfig!.websearch.headers).toEqual({ Authorization: "Bearer test-from-secrets" })
		} finally {
			process.chdir(previousCwd)
			rmSync(dir, { recursive: true, force: true })
		}
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
