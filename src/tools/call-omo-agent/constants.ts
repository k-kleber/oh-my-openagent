export const ALLOWED_AGENTS = [
  "explore",
  "deep-explorer",
  "librarian",
  "tester",
  "oracle",
  "hephaestus",
  "metis",
  "momus",
  "multimodal-looker",
] as const

export const CALL_OMO_AGENT_DESCRIPTION = `Spawn specialized subagent directly. run_in_background REQUIRED (true=async with task_id, false=sync).

Available: {agents}

Pass \`session_id=<id>\` to continue previous agent with full context. Nested subagent depth is tracked automatically and blocked past the configured limit. Prompts MUST be in English. Use \`background_output\` for async results.`
