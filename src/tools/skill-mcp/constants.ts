export const SKILL_MCP_TOOL_NAME = "skill_mcp"

export const SKILL_MCP_DESCRIPTION = `Invoke MCP server operations from skill-embedded MCPs. Requires mcp_name plus exactly one of: tool_name, resource_name, or prompt_name.`

export const BUILTIN_MCP_TOOL_HINTS: Record<string, string[]> = {
  context7: ["context7_resolve-library-id", "context7_query-docs"],
  websearch: ["websearch_web_search_exa", "websearch_tavily_search"],
  grep_app: ["grep_app_searchGitHub"],
  hindsight: ["hindsight_recall", "hindsight_retain", "hindsight_list_banks", "hindsight_create_bank"],
  openmemory: ["openmemory_query", "openmemory_store", "openmemory_reinforce", "openmemory_list"],
}
