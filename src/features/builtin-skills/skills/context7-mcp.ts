import type { BuiltinSkill } from "../types"

export const context7McpSkill: BuiltinSkill = {
  name: "context7-mcp",
  description:
    "On-demand Context7 MCP access for official library/framework documentation lookup without always-on MCP mounting.",
  template: `# Context7 MCP (On-Demand)

Use this skill when you need official library documentation and API examples.

## When to use

- Working with external libraries/frameworks
- Need authoritative usage patterns or API syntax
- Need version-specific docs guidance

## Preferred workflow

1. resolve library id using context7_resolve-library-id
2. query docs using context7_query-docs

## Guardrails

- Prefer official docs over random blogs
- Include concrete examples/snippets when relevant
- Keep doc fetch targeted to the user task`,
  mcpConfig: {
    context7: {
      type: "http",
      url: "https://mcp.context7.com/mcp",
      ...(process.env.CONTEXT7_API_KEY
        ? { headers: { Authorization: `Bearer ${process.env.CONTEXT7_API_KEY}` } }
        : {}),
    },
  },
}
