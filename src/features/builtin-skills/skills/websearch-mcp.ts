import type { BuiltinSkill } from "../types"
import type { WebsearchConfig } from "../../../config/schema"

export function createWebsearchMcpSkill(config?: WebsearchConfig): BuiltinSkill {
  const provider = config?.provider ?? "exa"
  const isTavily = provider === "tavily"
  const tavilyHeaders: Record<string, string> | undefined = process.env.TAVILY_API_KEY
    ? { Authorization: `Bearer ${process.env.TAVILY_API_KEY}` }
    : undefined
  const exaHeaders: Record<string, string> | undefined = process.env.EXA_API_KEY
    ? { "x-api-key": process.env.EXA_API_KEY }
    : undefined

  const mcpConfig = isTavily
    ? {
        websearch: {
          type: "http" as const,
          url: "https://mcp.tavily.com/mcp/",
          ...(tavilyHeaders ? { headers: tavilyHeaders } : {}),
        },
      }
    : {
        websearch: {
          type: "http" as const,
          url: process.env.EXA_API_KEY
            ? `https://mcp.exa.ai/mcp?tools=web_search_exa&exaApiKey=${encodeURIComponent(process.env.EXA_API_KEY)}`
            : "https://mcp.exa.ai/mcp?tools=web_search_exa",
          ...(exaHeaders ? { headers: exaHeaders } : {}),
        },
      }

  return {
    name: "websearch-mcp",
    description:
      "On-demand websearch MCP access for external information lookup (Exa/Tavily) without always-on MCP mounting.",
    template: `# Websearch MCP (On-Demand)

Use this skill when you need external web information and citations.

## When to use

- User asks for current facts or external references
- You need docs/articles not present in local code
- You need quick market/news/context checks

## Preferred tool call

- Use the MCP tool exposed by the active websearch provider
- Keep queries specific and source-oriented

## Active provider

- ${provider}

## Guardrails

- Prefer local/repo evidence first when possible
- Limit web fanout for simple questions
- Cite sources when claims depend on web content`,
    mcpConfig,
  }
}
