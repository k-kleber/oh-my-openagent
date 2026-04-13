import { existsSync } from "node:fs"
import { join } from "node:path"
import type { AgentPromptMetadata } from "./types"
import type { AvailableSpecialist } from "../features/opencode-skill-loader/types"
import { formatSpecialistCatalog } from "../features/opencode-skill-loader/specialist-catalog"

export interface AvailableAgent {
  name: string
  description: string
  metadata: AgentPromptMetadata
}

export interface AvailableTool {
  name: string
  category: "lsp" | "ast" | "search" | "session" | "command" | "other"
}

export interface AvailableSkill {
  name: string
  description: string
  location: "user" | "project" | "plugin"
}

export type CavemanTier = "lite" | "full" | "ultra"

export interface AvailableCategory {
  name: string
  description: string
  model?: string
}

export function categorizeTools(toolNames: string[]): AvailableTool[] {
  return toolNames.map((name) => {
    let category: AvailableTool["category"] = "other"
    if (name.startsWith("lsp_")) {
      category = "lsp"
    } else if (name.startsWith("ast_grep")) {
      category = "ast"
    } else if (name === "grep" || name === "glob") {
      category = "search"
    } else if (name.startsWith("session_")) {
      category = "session"
    } else if (name === "skill") {
      category = "command"
    }
    return { name, category }
  })
}

function formatToolsForPrompt(tools: AvailableTool[]): string {
  const lspTools = tools.filter((t) => t.category === "lsp")
  const astTools = tools.filter((t) => t.category === "ast")
  const searchTools = tools.filter((t) => t.category === "search")

  const parts: string[] = []

  if (searchTools.length > 0) {
    parts.push(...searchTools.map((t) => `\`${t.name}\``))
  }

  if (lspTools.length > 0) {
    parts.push("`lsp_*`")
  }

  if (astTools.length > 0) {
    parts.push("`ast_grep`")
  }

  return parts.join(", ")
}

export function buildKeyTriggersSection(agents: AvailableAgent[], _skills: AvailableSkill[] = []): string {
  const keyTriggers = agents
    .filter((a) => a.metadata.keyTrigger)
    .map((a) => `- ${a.metadata.keyTrigger}`)

  if (keyTriggers.length === 0) return ""

  return `### Key Triggers (check BEFORE classification):

${keyTriggers.join("\n")}
- **"Look into" + "create PR"** → Not just research. Full implementation cycle expected.`
}

export function buildToolSelectionTable(
  agents: AvailableAgent[],
  tools: AvailableTool[] = [],
  _skills: AvailableSkill[] = []
): string {
  const rows: string[] = [
    "### Tool & Agent Selection:",
    "",
  ]

  if (tools.length > 0) {
    const toolsDisplay = formatToolsForPrompt(tools)
    rows.push(`- ${toolsDisplay} — **FREE** — Not Complex, Scope Clear, No Implicit Assumptions`)
  }

  const costOrder = { FREE: 0, CHEAP: 1, EXPENSIVE: 2 }
  const sortedAgents = [...agents]
    .filter((a) => a.metadata.category !== "utility")
    .sort((a, b) => costOrder[a.metadata.cost] - costOrder[b.metadata.cost])

  for (const agent of sortedAgents) {
    const shortDesc = agent.description.split(".")[0] || agent.description
    rows.push(`- \`${agent.name}\` agent — **${agent.metadata.cost}** — ${shortDesc}`)
  }

  rows.push("")
  rows.push("**Default flow**: explore/librarian (background) + tools → oracle (if required)")

  return rows.join("\n")
}

export function buildExploreSection(agents: AvailableAgent[]): string {
  const exploreAgent = agents.find((a) => a.name === "explore")
  const deepExploreAgent = agents.find((a) => a.name === "deep-explorer")
  if (!exploreAgent) return ""

  const useWhen = exploreAgent.metadata.useWhen || []
  const avoidWhen = exploreAgent.metadata.avoidWhen || []

  const deepExploreUseWhen = deepExploreAgent?.metadata.useWhen || []

  return `### Explore Agents = Contextual Grep Cascade

Use \`explore\` for smaller scoped discovery and \`deep-explorer\` for heavier exploration that may require fan-out.

**Fast chooser:**
- Use \`explore\` when search scope is focused and likely solvable in one pass.
- Use \`deep-explorer\` when scope is broad/uncertain/cross-module and benefits from spawning multiple \`explore\` workers.

Use it as a **peer tool**, not a fallback. Fire liberally for discovery, not for files you already know.

**Delegation Trust Rule:** Once you fire an explore agent for a search, do **not** manually perform that same search yourself. Use direct tools only for non-overlapping work or when you intentionally skipped delegation.

**Use Direct Tools when:**
${avoidWhen.map((w) => `- ${w}`).join("\n")}

**Use Explore Agent when:**
${useWhen.map((w) => `- ${w}`).join("\n")}

${deepExploreAgent ? `**Use Deep-Explorer when:**
${deepExploreUseWhen.map((w) => `- ${w}`).join("\n")}

**Deep-Explorer delegation boundary:**
- deep-explorer may spawn \`explore\` only (no librarian/oracle/other subagents).` : ""}`
}

export function buildLibrarianSection(agents: AvailableAgent[]): string {
  const librarianAgent = agents.find((a) => a.name === "librarian")
  if (!librarianAgent) return ""

  const useWhen = librarianAgent.metadata.useWhen || []

  return `### Librarian Agent = Reference Grep

Search **external references** (docs, OSS, web). Fire proactively when unfamiliar libraries are involved.

**Contextual Grep (Internal)** — search OUR codebase, find patterns in THIS repo, project-specific logic.
**Reference Grep (External)** — search EXTERNAL resources, official API docs, library best practices, OSS implementation examples.

**Trigger phrases** (fire librarian immediately):
${useWhen.map((w) => `- "${w}"`).join("\n")}`
}

export function buildDelegationTable(agents: AvailableAgent[]): string {
  const rows: string[] = [
    "### Delegation Table:",
    "",
  ]

  for (const agent of agents) {
    for (const trigger of agent.metadata.triggers) {
      rows.push(`- **${trigger.domain}** → \`${agent.name}\` — ${trigger.trigger}`)
    }
  }

  return rows.join("\n")
}

export function buildMemorySection(): string {
  return `## Memory Integration

Before delegating research to explore or librarian, delegate to a memory-retrieval subagent to surface relevant prior context: \`task(subagent_type="memory-retrieval", load_skills=[], prompt="Recall and verify memory relevant to: <user's request>\\nProject: <projectPath> (<projectName>)", run_in_background=false)\`. Hindsight and OpenMemory are native always-on MCPs, so no memory skill needs to be mounted first. Memory retrieval is memory-only: on memory miss, do not perform fallback repo discovery; return a concise no-memory result. Treat recalled memory as advisory until verified against current code.

After completing significant work (architectural decisions, bug fixes with non-obvious cause, pattern discoveries), consider triggering memory capture: \`task(subagent_type="memory-store", load_skills=[], prompt="Project: <projectPath> (<projectName>)\\nObservations:\\n- <list of insights>", run_in_background=false)\`. Only capture high-signal, non-obvious, actionable insights.`
}

export function buildGraphifySection(directory?: string): string {
  if (!directory) return ""
  const graphPath = join(directory, "graphify-out", "graph.json")
  if (!existsSync(graphPath)) return ""
  return `## Knowledge Graph (Graphify)

If \`graphify-out/graph.json\` exists in the project root, you MUST:
1. Load the graphify skill: \`skill("graphify")\`
2. Read \`graphify-out/GRAPH_REPORT.md\` for architecture context before exploring the codebase
3. Use graph queries to understand module boundaries and dependencies before searching

This gives you a persistent map of the codebase structure across sessions.`
}

export function buildCategorySkillsDelegationGuide(categories: AvailableCategory[], skills: AvailableSkill[], specialists: AvailableSpecialist[] = []): string {
  if (categories.length === 0 && skills.length === 0 && specialists.length === 0) return ""

  const categoryRows = categories.map((c) => {
    const desc = c.description || c.name
    return `- \`${c.name}\` — ${desc}`
  })

  const builtinSkills = skills.filter((s) => s.location === "plugin")
  const customSkills = skills.filter((s) => s.location !== "plugin")

  const builtinNames = builtinSkills.map((s) => s.name).join(", ")
  const customNames = customSkills.map((s) => {
    const source = s.location === "project" ? "project" : "user"
    return `${s.name} (${source})`
  }).join(", ")

  let skillsSection: string

  if (customSkills.length > 0 && builtinSkills.length > 0) {
    skillsSection = `#### Available Skills (via \`skill\` tool)

**Built-in**: ${builtinNames}
**⚡ YOUR SKILLS (PRIORITY)**: ${customNames}

> User-installed skills OVERRIDE built-in defaults. ALWAYS prefer YOUR SKILLS when domain matches.
> Full skill descriptions → use the \`skill\` tool to check before EVERY delegation.`
  } else if (customSkills.length > 0) {
    skillsSection = `#### Available Skills (via \`skill\` tool)

**⚡ YOUR SKILLS (PRIORITY)**: ${customNames}

> User-installed skills OVERRIDE built-in defaults. ALWAYS prefer YOUR SKILLS when domain matches.
> Full skill descriptions → use the \`skill\` tool to check before EVERY delegation.`
  } else if (builtinSkills.length > 0) {
    skillsSection = `#### Available Skills (via \`skill\` tool)

**Built-in**: ${builtinNames}

> Full skill descriptions → use the \`skill\` tool to check before EVERY delegation.`
  } else {
    skillsSection = ""
  }

  const specialistCatalog = formatSpecialistCatalog(specialists)

  return `### Category + Skills Delegation System

**task() combines categories and skills for optimal task execution.**

#### Available Categories (Domain-Optimized Models)

Each category is configured with a model optimized for that domain. Read the description to understand when to use it.

${categoryRows.join("\n")}

${skillsSection}

${specialistCatalog}

---

### MANDATORY: Category + Skill Selection Protocol

**STEP 1: Select Category**
- Read each category's description
- Match task requirements to category domain
- Select the category whose domain BEST fits the task

**STEP 2: Evaluate ALL Skills**
Check the \`skill\` tool for available skills and their descriptions. For EVERY skill, ask:
> "Does this skill's expertise domain overlap with my task?"

- If YES → INCLUDE in \`load_skills=[...]\`
- If NO → OMIT (no justification needed)
${customSkills.length > 0 ? `
> **User-installed skills get PRIORITY.** When in doubt, INCLUDE rather than omit.` : ""}

---

### Delegation Pattern

\`\`\`typescript
task(
  category="[selected-category]",
  load_skills=["skill-1", "skill-2"],  // Include ALL relevant skills — ESPECIALLY user-installed ones
  prompt="..."
)
\`\`\`

**ANTI-PATTERN (will produce poor results):**
\`\`\`typescript
task(category="...", load_skills=[], run_in_background=false, prompt="...")  // Empty load_skills without justification
\`\`\`

---

### Category Domain Matching (ZERO TOLERANCE)

Every delegation MUST use the category that matches the task's domain. Mismatched categories produce measurably worse output because each category runs on a model optimized for that specific domain.

**VISUAL WORK = ALWAYS \`visual-engineering\`. NO EXCEPTIONS.**

Any task involving UI, UX, CSS, styling, layout, animation, design, or frontend components MUST go to \`visual-engineering\`. Never delegate visual work to \`quick\`, \`unspecified-*\`, or any other category.

\`\`\`typescript
// CORRECT: Visual work → visual-engineering category
task(category="visual-engineering", load_skills=["frontend-ui-ux"], prompt="Redesign the sidebar layout with new spacing...")

// WRONG: Visual work in wrong category — WILL PRODUCE INFERIOR RESULTS
task(category="quick", load_skills=[], prompt="Redesign the sidebar layout with new spacing...")
\`\`\`

| Task Domain | MUST Use Category |
|---|---|
| UI, styling, animations, layout, design | \`visual-engineering\` |
| Hard logic, architecture decisions, algorithms | \`ultrabrain\` |
| Mid-complexity bounded implementation (1-3 modules) | \`focused\` |
| Autonomous research + end-to-end implementation | \`deep\` |
| Single-file typo, trivial config change | \`quick\` |

    **When in doubt about category, it is almost never \`quick\` or \`unspecified-*\`. Match the domain.**

    ---

    ### Specialist Selection Guidance

    When delegating, choose between three dispatch styles: (1) direct specialist selection (explicit agent alias), (2) skill-led composition (explicit \`load_skills\` list), or (3) the generalist category-based path. Use the hybrid rules below to decide.

    Hybrid routing rules:
    - Direct specialist selection: use when user intent is explicit and unambiguous (the user names a specialist, or the task requires the specialist's unique toolset or lifecycle semantics).
    - Soft specialist suggestion: when repository evidence and skill/agent metadata yield high confidence, suggest a specialist but include a skill-list fallback in the prompt so the orchestration remains robust.
    - Fallback to generalist: when confidence is low, prefer a category + skill composition and avoid binding a first-class specialist alias.

    Writing specialist guardrail:
    - Prefer fused composition: prefer the shared writing layer (\`writing-base\`) plus research stage (\`writing-research\`) and explicit stages (outline → draft → revision) instead of instantiating multiple overlapping persona specialists.
    - Do not duplicate standalone persona skills. Use stage-specific skills (outline/draft) composed with the common writing layer.

    Coding specialist guardrail:
    - Stay language-agnostic by default. Attach a language-specific add-on skill only when repository evidence or explicit user intent justifies it.
    - When a language-specific add-on is used, preserve the shared generic coding-guideline layer (for example \`code-intelligence\` or a project-wide guideline skill) and treat the language-specific skill as an extension, not a replacement.

    Promotion rubric (when to promote to a first-class specialist agent):
    - Prefer skill-led specialists by default (use \`load_skills\` with explicit skills).
    - Reserve promotion to a first-class agent when one or more conditions apply:
      1. Hard tool restrictions require the specialist's unique toolset or denied-tool constraints.
      2. Custom fallback or model policy cannot be expressed via skills alone.
      3. Lifecycle semantics demand session continuity, gating, or long-running coordination that a specialist agent provides.

    Implementation note: do not change default categories or subagent semantics. This guidance is advisory: prefer specialists when justified, but do not force specialist selection.
    `
  }

export function buildOracleSection(agents: AvailableAgent[]): string {
  const oracleAgent = agents.find((a) => a.name === "oracle")
  if (!oracleAgent) return ""

  const useWhen = oracleAgent.metadata.useWhen || []
  const avoidWhen = oracleAgent.metadata.avoidWhen || []

  return `<Oracle_Usage>
## Oracle — Read-Only High-IQ Consultant

Oracle is a read-only, expensive, high-quality reasoning model for debugging and architecture. Consultation only.

### WHEN to Consult (Oracle FIRST, then implement):

${useWhen.map((w) => `- ${w}`).join("\n")}

### WHEN NOT to Consult:

${avoidWhen.map((w) => `- ${w}`).join("\n")}

### Usage Pattern:
Briefly announce "Consulting Oracle for [reason]" before invocation.

**Exception**: This is the ONLY case where you announce before acting. For all other work, start immediately without status updates.

### Oracle Background Task Policy:

**Collect Oracle results before your final answer. No exceptions.**

- Oracle takes minutes. When done with your own work: **end your response** — wait for the \`<system-reminder>\`.
- Do NOT poll \`background_output\` on a running Oracle. The notification will come.
- Never cancel Oracle.
</Oracle_Usage>`
}

export function buildHardBlocksSection(): string {
  const blocks = [
    "- Type error suppression (`as any`, `@ts-ignore`) — **Never**",
    "- Commit without explicit request — **Never**",
    "- Speculate about unread code — **Never**",
    "- Leave code in broken state after failures — **Never**",
    "- `background_cancel(all=true)` — **Never.** Always cancel individually by taskId.",
    "- Delivering final answer before collecting Oracle result — **Never.**",
  ]

  return `## Hard Blocks (NEVER violate)

${blocks.join("\n")}`
}

export function buildAntiPatternsSection(): string {
  const patterns = [
    "- **Type Safety**: `as any`, `@ts-ignore`, `@ts-expect-error`",
    "- **Error Handling**: Empty catch blocks `catch(e) {}`",
    "- **Testing**: Deleting failing tests to \"pass\"",
    "- **Search**: Firing agents for single-line typos or obvious syntax errors",
    "- **Debugging**: Shotgun debugging, random changes",
    "- **Background Tasks**: Polling `background_output` on running tasks — end response and wait for notification",
    "- **Delegation Duplication**: Delegating exploration to explore/librarian and then manually doing the same search yourself",
    "- **Oracle**: Delivering answer without collecting Oracle results",
  ]

  return `## Anti-Patterns (BLOCKING violations)

${patterns.join("\n")}`
}

export function buildToolCallFormatSection(): string {
  return `## Tool Call Format (CRITICAL)

**ALWAYS use the native tool calling mechanism. NEVER output tool calls as text.**

When you need to call a tool:
1. Use the tool call interface provided by the system
2. Do NOT write tool calls as plain text like \`assistant to=functions.XXX\`
3. Do NOT output JSON directly in your text response
4. The system handles tool call formatting automatically

**CORRECT**: Invoke the tool through the tool call interface
**WRONG**: Writing \`assistant to=functions.todowrite\` or \`json\n{...}\` as text

Your tool calls are processed automatically. Just invoke the tool - do not format the call yourself.`
}

export function buildNonClaudePlannerSection(model: string): string {
  const isNonClaude = !model.toLowerCase().includes('claude')
  if (!isNonClaude) return ""

  return `### Plan Agent Dependency (Non-Claude)

Multi-step task? **ALWAYS consult Plan Agent first.** Do NOT start implementation without a plan.

- Single-file fix or trivial change → proceed directly
- Anything else (2+ steps, unclear scope, architecture) → \`task(subagent_type="plan", ...)\` FIRST
- Use \`session_id\` to resume the same Plan Agent — ask follow-up questions aggressively
- If ANY part of the task is ambiguous, ask Plan Agent before guessing

Plan Agent returns a structured work breakdown with parallel execution opportunities. Follow it.`
}

export function buildParallelDelegationSection(model: string, categories: AvailableCategory[]): string {
  const isNonClaude = !model.toLowerCase().includes('claude')
  const hasDelegationCategory = categories.some(c => c.name === 'deep' || c.name === 'unspecified-high')

  if (!isNonClaude || !hasDelegationCategory) return ""

  return `### DECOMPOSE AND DELEGATE — YOU ARE NOT AN IMPLEMENTER

**YOUR FAILURE MODE: You attempt to do work yourself instead of decomposing and delegating.** When you implement directly, the result is measurably worse than when specialized subagents do it. Subagents have domain-specific configurations, loaded skills, and tuned prompts that you lack.

**MANDATORY — for ANY implementation task:**

1. **ALWAYS decompose** the task into independent work units. No exceptions. Even if the task "feels small", decompose it.
2. **ALWAYS delegate** EACH unit to a \`deep\` or \`unspecified-high\` agent in parallel (\`run_in_background=true\`).
3. **NEVER work sequentially.** If 4 independent units exist, spawn 4 agents simultaneously. Not 1 at a time. Not 2 then 2.
4. **NEVER implement directly** when delegation is possible. You write prompts, not code.

**YOUR PROMPT TO EACH AGENT MUST INCLUDE:**
- GOAL with explicit success criteria (what "done" looks like)
- File paths and constraints (where to work, what not to touch)
- Existing patterns to follow (reference specific files the agent should read)
- Clear scope boundary (what is IN scope, what is OUT of scope)

**Vague delegation = failed delegation.** If your prompt to the subagent is shorter than 5 lines, it is too vague.

| You Want To Do | You MUST Do Instead |
|---|---|
| Write code yourself | Delegate to \`deep\` or \`unspecified-high\` agent |
| Handle 3 changes sequentially | Spawn 3 agents in parallel |
| "Quickly fix this one thing" | Still delegate — your "quick fix" is slower and worse than a subagent's |

**Your value is orchestration, decomposition, and quality control. Delegating with crystal-clear prompts IS your work.**`
}

export function buildUltraworkSection(
  agents: AvailableAgent[],
  categories: AvailableCategory[],
  skills: AvailableSkill[]
): string {
  const lines: string[] = []

  if (categories.length > 0) {
    lines.push("**Categories** (for implementation tasks):")
    for (const cat of categories) {
      const shortDesc = cat.description || cat.name
      lines.push(`- \`${cat.name}\`: ${shortDesc}`)
    }
    lines.push("")
  }

  if (skills.length > 0) {
    const builtinSkills = skills.filter((s) => s.location === "plugin")
    const customSkills = skills.filter((s) => s.location !== "plugin")

    if (builtinSkills.length > 0) {
      lines.push("**Built-in Skills** (combine with categories):")
      for (const skill of builtinSkills) {
        const shortDesc = skill.description.split(".")[0] || skill.description
        lines.push(`- \`${skill.name}\`: ${shortDesc}`)
      }
      lines.push("")
    }

    if (customSkills.length > 0) {
      lines.push("**User-Installed Skills** (HIGH PRIORITY - user installed these for their workflow):")
      for (const skill of customSkills) {
        const shortDesc = skill.description.split(".")[0] || skill.description
        lines.push(`- \`${skill.name}\`: ${shortDesc}`)
      }
      lines.push("")
    }
  }

  if (agents.length > 0) {
    const ultraworkAgentPriority = ["explore", "librarian", "plan", "oracle"]
    const sortedAgents = [...agents].sort((a, b) => {
      const aIdx = ultraworkAgentPriority.indexOf(a.name)
      const bIdx = ultraworkAgentPriority.indexOf(b.name)
      if (aIdx === -1 && bIdx === -1) return 0
      if (aIdx === -1) return 1
      if (bIdx === -1) return -1
      return aIdx - bIdx
    })

    lines.push("**Agents** (for specialized consultation/exploration):")
    for (const agent of sortedAgents) {
      const shortDesc = agent.description.length > 120 ? agent.description.slice(0, 120) + "..." : agent.description
      const suffix = agent.name === "explore" || agent.name === "librarian" ? " (multiple)" : ""
      lines.push(`- \`${agent.name}${suffix}\`: ${shortDesc}`)
    }
  }

  return lines.join("\n")
}

// Anti-duplication section for agent prompts
export function buildAntiDuplicationSection(): string {
  return `<Anti_Duplication>
## Anti-Duplication Rule (CRITICAL)

Once you delegate exploration to explore/librarian agents, **DO NOT perform the same search yourself**.

### Dependency Gate (MANDATORY)

If your next step depends on delegated explore/librarian results, you MUST pause and wait.

- Do **not** continue implementation or analysis that uses those results before collecting them.
- If you launched multiple background tasks, do **not** continue dependent work until all required task_ids are collected.
- Do **not** "fill the gap" with your own overlapping grep/read attempts.
- If no genuinely independent work exists, **end your response immediately** and wait for completion notification.
- Resume only after collecting results via \`background_output(task_id="...")\`.

### What this means:

**FORBIDDEN:**
- After firing explore/librarian, manually grep/search for the same information
- Re-doing the research the agents were just tasked with
- "Just quickly checking" the same files the background agents are checking

**ALLOWED:**
- Continue with **non-overlapping work** — work that doesn't depend on the delegated research
- Work on unrelated parts of the codebase
- Preparation work (e.g., setting up files, configs) that can proceed independently

### Wait for Results Properly:

When you need the delegated results but they're not ready:

1. **End your response** — do NOT continue with work that depends on those results
2. **Wait for the completion notification** — the system will trigger your next turn
3. **Then** collect results via \`background_output(task_id="...")\` for each required task_id
4. **For parallel fanout**, wait until all required tasks are complete and collected before dependent reasoning
5. **Do NOT** impatiently re-search the same topics while waiting
6. **Do NOT** proceed with inferred/assumed findings — no dependency bypassing

### Why This Matters:

- **Wasted tokens**: Duplicate exploration wastes your context budget
- **Confusion**: You might contradict the agent's findings
- **Efficiency**: The whole point of delegation is parallel throughput

### Example:

\`\`\`typescript
// WRONG: After delegating, re-doing the search
task(subagent_type="explore", run_in_background=true, ...)
// Then immediately grep for the same thing yourself — FORBIDDEN

// CORRECT: Continue non-overlapping work
task(subagent_type="explore", run_in_background=true, ...)
// Work on a different, unrelated file while they search
// End your response and wait for the notification
\`\`\`
</Anti_Duplication>`
}

const CAVEMAN_TIER_ROUTING: Record<string, CavemanTier> = {
  // LITE: brainstormer, researcher, writer, atlas, multimodal-looker, metis, memory-retrieval, memory-store
  sisyphus: "ultra",  // TESTING: sisyphus on ultra tier for actual terseness
  brainstormer: "lite",
  researcher: "lite",
  writer: "lite",
  atlas: "lite",
  "multimodal-looker": "lite",
  metis: "lite",
  "memory-retrieval": "lite",
  "memory-store": "lite",

  // FULL: explore, librarian, deep-explorer, debugger, oracle, momus, hephaestus
  explore: "full",
  librarian: "full",
  "deep-explorer": "full",
  debugger: "full",
  oracle: "full",
  momus: "full",
  hephaestus: "full",

  // ULTRA: sisyphus-junior, tester
  "sisyphus-junior": "ultra",
  tester: "ultra",
}

/**
 * Returns the Caveman tier for a given agent name.
 * Returns null if the agent is not mapped for Caveman support.
 */
export function getCavemanTierForAgent(agentName: string): CavemanTier | null {
  return CAVEMAN_TIER_ROUTING[agentName] || null
}

/**
 * Returns the verbatim Caveman prompt block for the given tier.
 */
export function buildCavemanSection(tier: CavemanTier): string {
  if (tier === "lite") {
    return `<Caveman_Rules>
## Grunt Level: lite

No filler/hedging. Keep articles + full sentences. Professional but tight

### Example:
Your component re-renders because you create a new object reference each render. Inline object props fail shallow comparison every time. Wrap it in useMemo.
</Caveman_Rules>`
  }

  if (tier === "full") {
    return `<Caveman_Rules>
## Grunt Level: full

Strip articles (the, a, an). Fragments OK. Use short synonyms. No hedging, no filler. One sentence per point max. Lines short.

### Example:
Component re-renders: new object reference created each render. Inline object props fail shallow comparison. Wrap in useMemo to stabilize.
</Caveman_Rules>`
  }

  if (tier === "ultra") {
    return `<Caveman_Rules>
## Grunt Level: ultra

Abbreviate (DB/auth/config/req/res/fn/impl), strip conjunctions, arrows for causality (X → Y), one word when one word enough

### Example:
Inline obj prop → new ref → re-render. useMemo.
</Caveman_Rules>`
  }

  return ""
}

/**
 * Gated helper: returns empty string if disabled or agent not mapped,
 * otherwise returns the appropriate tier block.
 */
export function maybeBuildCavemanSection(agentName: string, cavemanEnabled: boolean): string {
  if (!cavemanEnabled) return ""

  const tier = getCavemanTierForAgent(agentName)
  if (!tier) return ""

  return buildCavemanSection(tier)
}
