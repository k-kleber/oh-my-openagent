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
  serena_read_memory: false,
  serena_list_memories: false,
  serena_delete_memory: false,
  serena_edit_memory: false,
  serena_write_memory: false,
  serena_execute_shell_command: false,
}

const MEMORY_TOOL_DENYLIST: Record<string, boolean> = {
  hindsight_retain: false,
  hindsight_create_bank: false,
  hindsight_create_directive: false,
  hindsight_delete_directive: false,
  hindsight_delete_memory: false,
  hindsight_delete_document: false,
  hindsight_delete_bank: false,
  hindsight_clear_memories: false,
  hindsight_create_mental_model: false,
  hindsight_update_mental_model: false,
  hindsight_delete_mental_model: false,
  hindsight_refresh_mental_model: false,
  hindsight_update_bank: false,
  openmemory_store: false,
  openmemory_reinforce: false,
  openmemory_delete: false,
}

const AGENT_RESTRICTIONS: Record<string, Record<string, boolean>> = {
  explore: EXPLORATION_AGENT_DENYLIST,

  "deep-explorer": {
    ...EXPLORATION_AGENT_DENYLIST,
    call_omo_agent: false,
  },

  "graphify-retrieval": {
    ...EXPLORATION_AGENT_DENYLIST,
    bash: false,
  },

  librarian: EXPLORATION_AGENT_DENYLIST,

  oracle: {
    write: false,
    edit: false,
    task: false,
    call_omo_agent: false,
  },

  tester: {
    write: false,
    edit: false,
    apply_patch: false,
    interactive_bash: false,
    task: false,
    call_omo_agent: false,
    question: false,
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
    ...MEMORY_TOOL_DENYLIST,
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

  sisyphus: {
    ...SERENA_MUTATION_TOOL_DENYLIST,
    ...MEMORY_TOOL_DENYLIST,
  },

  hephaestus: {
    ...SERENA_MUTATION_TOOL_DENYLIST,
    ...MEMORY_TOOL_DENYLIST,
  },

  prometheus: {
    ...SERENA_MUTATION_TOOL_DENYLIST,
    ...MEMORY_TOOL_DENYLIST,
  },

  researcher: {
    ...SERENA_MUTATION_TOOL_DENYLIST,
    ...MEMORY_TOOL_DENYLIST,
  },

  writer: {
    ...SERENA_MUTATION_TOOL_DENYLIST,
    ...MEMORY_TOOL_DENYLIST,
  },

  debugger: {
    write: false,
    edit: false,
    call_omo_agent: false,
    bash: false,
    apply_patch: false,
    ...SERENA_MUTATION_TOOL_DENYLIST,
    ...MEMORY_TOOL_DENYLIST,
  },

  brainstormer: {
    write: true,
    edit: false,
    apply_patch: false,
    hashline_edit: false,
    ...SERENA_MUTATION_TOOL_DENYLIST,
    ...MEMORY_TOOL_DENYLIST,
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
