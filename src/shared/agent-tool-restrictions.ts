/**
 * Agent tool restrictions for session.prompt calls.
 * OpenCode SDK's session.prompt `tools` parameter expects boolean values.
 * true = tool allowed, false = tool denied.
 */

const EXPLORATION_AGENT_DENYLIST: Record<string, boolean> = {
  write: false,
  edit: false,
  task: false,
  call_omo_agent: false,
}

const SERENA_MUTATION_TOOL_DENYLIST: Record<string, boolean> = {
  serena_create_text_file: false,
  serena_replace_content: false,
  serena_replace_symbol_body: false,
  serena_insert_after_symbol: false,
  serena_insert_before_symbol: false,
  serena_rename_symbol: false,
  serena_delete_memory: false,
  serena_edit_memory: false,
  serena_write_memory: false,
  serena_execute_shell_command: false,
}

const AGENT_RESTRICTIONS: Record<string, Record<string, boolean>> = {
  explore: EXPLORATION_AGENT_DENYLIST,

  librarian: EXPLORATION_AGENT_DENYLIST,

  oracle: {
    write: false,
    edit: false,
    task: false,
    call_omo_agent: false,
  },

  debugger: {
    write: false,
    edit: false,
    call_omo_agent: false,
    bash: false,
    apply_patch: false,
  },

  metis: {
    write: false,
    edit: false,
  },

  momus: {
    write: false,
    edit: false,
    task: false,
  },

  "multimodal-looker": {
    read: true,
  },

  "sisyphus-junior": {
    call_omo_agent: false,
  },

  brainstormer: {
    write: true,
    edit: false,
    apply_patch: false,
    hashline_edit: false,
    ...SERENA_MUTATION_TOOL_DENYLIST,
  },
}

export function getAgentToolRestrictions(agentName: string): Record<string, boolean> {
  return AGENT_RESTRICTIONS[agentName]
    ?? Object.entries(AGENT_RESTRICTIONS).find(([key]) => key.toLowerCase() === agentName.toLowerCase())?.[1]
    ?? {}
}

export function hasAgentToolRestrictions(agentName: string): boolean {
  const restrictions = AGENT_RESTRICTIONS[agentName]
    ?? Object.entries(AGENT_RESTRICTIONS).find(([key]) => key.toLowerCase() === agentName.toLowerCase())?.[1]
  return restrictions !== undefined && Object.keys(restrictions).length > 0
}
