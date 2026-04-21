import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { DelegateTaskArgs, DelegatedModelConfig, ToolContextWithMetadata, DelegateTaskToolOptions } from "./types"
import { CATEGORY_DESCRIPTIONS } from "./constants"
import { SISYPHUS_JUNIOR_AGENT } from "./sisyphus-junior-agent"
import { mergeCategories } from "../../shared/merge-categories"
import { log } from "../../shared/logger"
import { getAgentConfigKey } from "../../shared/agent-display-names"
import { buildSystemContent } from "./prompt-builder"
import type {
  AvailableCategory,
  AvailableSkill,
} from "../../agents/dynamic-agent-prompt-builder"
import {
  resolveSkillContent,
  resolveParentContext,
  executeBackgroundContinuation,
  executeSyncContinuation,
  resolveCategoryExecution,
  resolveSubagentExecution,
  executeUnstableAgentTask,
  executeBackgroundTask,
  executeSyncTask,
} from "./executor"

export { resolveCategoryConfig } from "./categories"
export type { SyncSessionCreatedEvent, DelegateTaskToolOptions, BuildSystemContentInput } from "./types"
export { buildSystemContent, buildTaskPrompt } from "./prompt-builder"

export function createDelegateTask(options: DelegateTaskToolOptions): ToolDefinition {
  const { userCategories } = options

  const allCategories = mergeCategories(userCategories)
  const categoryNames = Object.keys(allCategories)
  const categoryExamples = categoryNames.join(", ")

  const availableCategories: AvailableCategory[] = options.availableCategories
    ?? Object.entries(allCategories).map(([name, categoryConfig]) => {
      const userDesc = userCategories?.[name]?.description
      const builtinDesc = CATEGORY_DESCRIPTIONS[name]
      const description = userDesc || builtinDesc || "General tasks"
      return {
        name,
        description,
        model: categoryConfig.model,
      }
    })

  const availableSkills: AvailableSkill[] = options.availableSkills ?? []
  const availableSkillNames = new Set(availableSkills.map((skill) => skill.name.toLowerCase()))

  const defaultSkillsBySubagent: Record<string, string[]> = {
    explore: [
      "global-tooling-preference",
    ],
    "deep-explorer": [
      "global-tooling-preference",
    ],
    librarian: [
      "global-tooling-preference",
      "context7-mcp",
      "websearch-mcp",
      "tool-doc-ripgrep",
      "tool-doc-fd",
      "tool-doc-sd",
    ],
    ...(options.defaultSkillsBySubagent ?? {}),
  }

  const categoryList = categoryNames.map(name => {
    const userDesc = userCategories?.[name]?.description
    const builtinDesc = CATEGORY_DESCRIPTIONS[name]
    const desc = userDesc || builtinDesc
    return desc ? `  - ${name}: ${desc}` : `  - ${name}`
  }).join("\n")

  const brainstormerAllowedSubagents = new Set(["explore", "deep-explorer", "librarian", "memory-retrieval"])
  const debuggerAllowedSubagents = new Set(["explore", "deep-explorer", "librarian", "memory-retrieval"])

  const description = `Spawn agent task with category-based or direct agent selection.
  
  ⚠️  CRITICAL: You MUST provide EITHER category, subagent_type, OR specialist. Omitting ALL THREE will FAIL.
  
  **COMMON MISTAKE (DO NOT DO THIS):**
  \`\`\`
  task(description="...", prompt="...", run_in_background=false)  // ❌ FAILS - missing routing (category/subagent_type/specialist)
  \`\`\`
  
  **CORRECT - Using category:**
  \`\`\`
  task(category="quick", load_skills=[], description="Fix type error", prompt="...", run_in_background=false)
  \`\`\`
  
  **CORRECT - Using subagent_type:**
  \`\`\`
  task(subagent_type="explore", load_skills=[], description="Find patterns", prompt="...", run_in_background=true)
  \`\`\`

  **CORRECT - Testing execution:**
  \`\`\`
  task(subagent_type="tester", load_skills=[], description="Run test suite", prompt="Run the relevant tests/build verification commands and report only pass/fail output with failure excerpts.", run_in_background=false)
  \`\`\`
  
  REQUIRED: Provide ONE of:
  - category: For task delegation (uses Sisyphus-Junior with category-optimized model)
  - subagent_type: For direct agent invocation (explore, deep-explorer, librarian, tester, oracle, etc.)
    - Use \`tester\` when the job is executing tests/build verification and reporting results without diagnosis.
  - specialist: For explicit specialist invocation
  
  **DO NOT provide more than one.** If multiple are provided, the tool will error to ensure deterministic routing.
  
  - load_skills: ALWAYS REQUIRED. Pass [] if no skills needed, or ["skill-1", "skill-2"] for category tasks.
  - category: Use predefined category → Spawns Sisyphus-Junior with category config
    Available categories:
  ${categoryList}
  - subagent_type: Use specific agent directly (explore, deep-explorer, librarian, tester, oracle, metis, momus)
  - specialist: Use specific specialist name directly
  - run_in_background: REQUIRED. true=async (returns task_id), false=sync (waits). Use background=true ONLY for parallel exploration with 5+ independent queries.
  - session_id: Existing Task session to continue (from previous task output). Continues agent with FULL CONTEXT PRESERVED - saves tokens, maintains continuity.
  - command: The command that triggered this task (optional, for slash command tracking).
  
  **WHEN TO USE session_id:**
  - Task failed/incomplete → session_id with "fix: [specific issue]"
  - Need follow-up on previous result → session_id with additional question
  - Multi-turn conversation with same agent → always session_id instead of new task
  
  Prompts MUST be in English.`

  return tool({
    description,
    args: {
      load_skills: tool.schema.array(tool.schema.string()).describe("Skill names to inject. REQUIRED - pass [] if no skills needed."),
      description: tool.schema.string().describe("Short task description (3-5 words)"),
      prompt: tool.schema.string().describe("Full detailed prompt for the agent"),
      run_in_background: tool.schema.boolean().describe("REQUIRED. true=async (returns task_id), false=sync (waits). Use false for task delegation, true ONLY for parallel exploration."),
      category: tool.schema.string().optional().describe(`REQUIRED if subagent_type or specialist not provided. Do NOT provide more than one.`),
      subagent_type: tool.schema.string().optional().describe("REQUIRED if category or specialist not provided. Do NOT provide more than one."),
      specialist: tool.schema.string().optional().describe("REQUIRED if category or subagent_type not provided. Do NOT provide more than one."),
      session_id: tool.schema.string().optional().describe("Existing Task session to continue"),
      command: tool.schema.string().optional().describe("The command that triggered this task"),
    },
    async execute(args: DelegateTaskArgs, toolContext) {
      const ctx = toolContext as ToolContextWithMetadata

      const normalizedSkillNames = new Set(availableSkills.map((skill) => skill.name.trim().toLowerCase()))

      const specialistToken = typeof args.specialist === "string" ? args.specialist.trim() : ""
      const specialistLooksLikeSkill = specialistToken !== "" && normalizedSkillNames.has(specialistToken.toLowerCase())
      const subagentToken = typeof args.subagent_type === "string" ? args.subagent_type.trim() : ""
      const normalizedCategory = typeof args.category === "string" ? args.category.trim().toLowerCase() : ""
      const normalizedSubagentToken = subagentToken.replace(/^@+/, "").toLowerCase()
      const normalizedSubagentConfigKey = subagentToken ? getAgentConfigKey(subagentToken) : ""
      const isCategoryEchoInSubagent = normalizedCategory !== "" && normalizedSubagentToken === normalizedCategory
      const isWritingCategoryWriterAlias = normalizedCategory === "writing" && normalizedSubagentConfigKey === "writer"
      const isCategoryImplementationAlias = normalizedSubagentConfigKey === getAgentConfigKey(SISYPHUS_JUNIOR_AGENT)

      if (args.category && (isCategoryEchoInSubagent || isWritingCategoryWriterAlias || isCategoryImplementationAlias)) {
        args.subagent_type = undefined
      }

      if (args.category && specialistLooksLikeSkill) {
        args.load_skills = Array.isArray(args.load_skills) ? args.load_skills : []
        if (!args.load_skills.some((skill) => skill.trim().toLowerCase() === specialistToken.toLowerCase())) {
          args.load_skills.push(specialistToken)
        }
        args.specialist = undefined
      }

      const routingOptionsCount = [args.category, args.subagent_type, args.specialist].filter(Boolean).length
      if (routingOptionsCount > 1) {
        return `Invalid arguments: Provide ONLY ONE of 'category', 'subagent_type', or 'specialist'. Got ${routingOptionsCount} routing options.`
      }

      if (args.specialist) {
        args.subagent_type = args.specialist
      }

      if (args.category) {
        if (args.subagent_type && args.subagent_type !== SISYPHUS_JUNIOR_AGENT) {
          log("[task] category provided - overriding subagent_type to sisyphus-junior", {
            category: args.category,
            subagent_type: args.subagent_type,
          })
        }
        args.subagent_type = SISYPHUS_JUNIOR_AGENT
      }

      const callerAgentConfigKey = getAgentConfigKey(ctx.agent ?? "")
      if (callerAgentConfigKey === "brainstormer") {
        if (args.category) {
          return `Brainstormer cannot delegate implementation categories. Use subagent_type="explore", "deep-explorer", "librarian", or "memory-retrieval" only.`
        }

        const requestedSubagent = args.subagent_type?.trim().replace(/^@+/, "").toLowerCase()
        if (!requestedSubagent) {
          return `Brainstormer must specify subagent_type. Allowed: explore, deep-explorer, librarian, memory-retrieval.`
        }

        if (!brainstormerAllowedSubagents.has(requestedSubagent)) {
          return `Brainstormer can only delegate to explore, deep-explorer, librarian, or memory-retrieval. Received: "${args.subagent_type}".`
        }
      }

      if (callerAgentConfigKey === "debugger") {
        if (args.category) {
          return `Debugger cannot delegate implementation categories. Use subagent_type="explore", "deep-explorer", "librarian", or "memory-retrieval" only.`
        }

        const requestedSubagent = args.subagent_type?.trim().replace(/^@+/, "").toLowerCase()
        if (!requestedSubagent) {
          return `Debugger must specify subagent_type. Allowed: explore, deep-explorer, librarian, memory-retrieval.`
        }

        if (!debuggerAllowedSubagents.has(requestedSubagent)) {
          return `Debugger can only delegate to explore, deep-explorer, librarian, or memory-retrieval. Received: "${args.subagent_type}".`
        }
      }

      await ctx.metadata?.({
        title: args.description,
      })

      if (args.run_in_background === undefined) {
        throw new Error(`Invalid arguments: 'run_in_background' parameter is REQUIRED. Specify run_in_background=false for task delegation, or run_in_background=true for parallel exploration.`)
      }
      if (typeof args.load_skills === "string") {
        try {
          const parsed = JSON.parse(args.load_skills)
          args.load_skills = Array.isArray(parsed) ? parsed : []
        } catch {
          args.load_skills = []
        }
      }
      if (args.load_skills === undefined) {
        throw new Error(`Invalid arguments: 'load_skills' parameter is REQUIRED. Pass [] if no skills needed.`)
      }
      if (args.load_skills === null) {
        throw new Error(`Invalid arguments: load_skills=null is not allowed. Pass [] if no skills needed.`)
      }

      if (args.load_skills.length === 0 && args.subagent_type) {
        const normalizedSubagent = args.subagent_type.trim().replace(/^@+/, "").toLowerCase()
        const defaultSkills = defaultSkillsBySubagent[normalizedSubagent] ?? []
        const injectedDefaults = defaultSkills.filter((skillName) =>
          availableSkillNames.has(skillName.toLowerCase())
        )

        if (injectedDefaults.length > 0) {
          args.load_skills = injectedDefaults
          log("[task] injected default skills for subagent", {
            subagent: normalizedSubagent,
            injectedDefaults,
          })
        }
      }

      const runInBackground = args.run_in_background === true

      const { content: skillContent, contents: skillContents, error: skillError } = await resolveSkillContent(args.load_skills, {
        gitMasterConfig: options.gitMasterConfig,
        browserProvider: options.browserProvider,
        disabledSkills: options.disabledSkills,
        directory: options.directory,
      })
      if (skillError) {
        return skillError
      }

      const parentContext = await resolveParentContext(ctx, options.client)

      if (args.session_id) {
        if (runInBackground) {
          return executeBackgroundContinuation(args, ctx, options, parentContext)
        }
        return executeSyncContinuation(args, ctx, options)
      }

      if (!args.category && !args.subagent_type && !args.specialist) {
        return `Invalid arguments: Must provide one of 'category', 'subagent_type', or 'specialist'.`
      }

      let systemDefaultModel: string | undefined
      try {
        const openCodeConfig = await options.client.config.get()
        systemDefaultModel = (openCodeConfig as { data?: { model?: string } })?.data?.model
      } catch {
        systemDefaultModel = undefined
      }

      const inheritedModel = parentContext.model
        ? `${parentContext.model.providerID}/${parentContext.model.modelID}`
        : undefined

      let agentToUse: string
      let categoryModel: DelegatedModelConfig | undefined
      let categoryPromptAppend: string | undefined
      let modelInfo: import("../../features/task-toast-manager/types").ModelFallbackInfo | undefined
      let actualModel: string | undefined
      let isUnstableAgent = false
      let fallbackChain: import("../../shared/model-requirements").FallbackEntry[] | undefined
      let maxPromptTokens: number | undefined

      if (args.category) {
        const resolution = await resolveCategoryExecution(args, options, inheritedModel, systemDefaultModel)
        if (resolution.error) {
          return resolution.error
        }
        agentToUse = resolution.agentToUse
        categoryModel = resolution.categoryModel
        categoryPromptAppend = resolution.categoryPromptAppend
        modelInfo = resolution.modelInfo
        actualModel = resolution.actualModel
        isUnstableAgent = resolution.isUnstableAgent
        fallbackChain = resolution.fallbackChain
        maxPromptTokens = resolution.maxPromptTokens

        const isRunInBackgroundExplicitlyFalse = args.run_in_background === false || args.run_in_background === "false" as unknown as boolean

        log("[task] unstable agent detection", {
          category: args.category,
          actualModel,
          isUnstableAgent,
          run_in_background_value: args.run_in_background,
          run_in_background_type: typeof args.run_in_background,
          isRunInBackgroundExplicitlyFalse,
          willForceBackground: isUnstableAgent && isRunInBackgroundExplicitlyFalse,
        })

        if (isUnstableAgent && isRunInBackgroundExplicitlyFalse) {
          const systemContent = buildSystemContent({
            skillContent,
            skillContents,
            categoryPromptAppend,
            agentName: agentToUse,
            maxPromptTokens,
            model: categoryModel,
            availableCategories,
            availableSkills,
          })
          return executeUnstableAgentTask(args, ctx, options, parentContext, agentToUse, categoryModel, systemContent, actualModel)
        }
      } else {
        const resolution = await resolveSubagentExecution(args, options, parentContext.agent, categoryExamples)
        if (resolution.error) {
          return resolution.error
        }
        agentToUse = resolution.agentToUse
        categoryModel = resolution.categoryModel
        fallbackChain = resolution.fallbackChain
      }

      const systemContent = buildSystemContent({
        skillContent,
        skillContents,
        categoryPromptAppend,
        agentName: agentToUse,
        maxPromptTokens,
        model: categoryModel,
        availableCategories,
        availableSkills,
      })

      if (runInBackground) {
        return executeBackgroundTask(args, ctx, options, parentContext, agentToUse, categoryModel, systemContent, fallbackChain)
      }

      return executeSyncTask(args, ctx, options, parentContext, agentToUse, categoryModel, systemContent, modelInfo, fallbackChain)
    },
  })
}
