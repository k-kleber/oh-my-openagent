# src/mcp/ — 6 Built-in Remote/Local MCPs

**Generated:** 2026-03-06

## OVERVIEW

Tier 1 of the three-tier MCP system. Native MCPs created via `createBuiltinMcps(disabledMcps, config)`.

## BUILT-IN MCPs

| Name | URL | Env Vars | Tools |
|------|-----|----------|-------|
| **serena** | local process | None | Code intelligence |
| **websearch** | `mcp.exa.ai` (default) or `mcp.tavily.com` | `EXA_API_KEY` (optional), `TAVILY_API_KEY` (if tavily) | Web search |
| **context7** | `mcp.context7.com/mcp` | `CONTEXT7_API_KEY` (optional) | Library documentation |
| **grep_app** | `mcp.grep.app` | None | GitHub code search |
| **hindsight** | `http://localhost:8888/mcp` | None | Temporal/project memory |
| **openmemory** | `http://localhost:8080/mcp` | `OPENMEMORY_API_KEY` (optional, falls back to `local-dev-key`) | Durable/project memory |

## REGISTRATION PATTERN

```typescript
// Static export (context7, grep_app)
export const context7 = {
  type: "remote" as const,
  url: "https://mcp.context7.com/mcp",
  enabled: true,
  oauth: false as const,
}

// Factory with config (websearch)
export function createWebsearchConfig(config?: WebsearchConfig): RemoteMcpConfig
```

## ENABLE/DISABLE

```jsonc
// Method 1: disabled_mcps array
{ "disabled_mcps": ["websearch", "context7"] }

// Method 2: enabled flag
{ "mcp": { "websearch": { "enabled": false } } }
```

## THREE-TIER SYSTEM

| Tier | Source | Mechanism |
|------|--------|-----------|
| 1. Built-in | `src/mcp/` | 6 native MCPs, created by `createBuiltinMcps()` |
| 2. Claude Code | `.mcp.json` | `${VAR}` expansion via `claude-code-mcp-loader` |
| 3. Skill-embedded | SKILL.md YAML | Managed by `SkillMcpManager` (stdio + HTTP) |

## FILES

| File | Purpose |
|------|---------|
| `index.ts` | `createBuiltinMcps()` factory |
| `types.ts` | `McpNameSchema`: "websearch" \| "context7" \| "grep_app" |
| `websearch.ts` | Exa/Tavily provider with config |
| `context7.ts` | Context7 with optional auth header |
| `grep-app.ts` | Grep.app (no auth) |
| `hindsight.ts` | Local Hindsight MCP |
| `openmemory.ts` | Local OpenMemory MCP |

## ROUTING GUIDE

### Native MCPs (use directly, never skill_mcp)

These MCPs are built-in and must be called via their native tool names:

| MCP | Native Tools | Use Instead of skill_mcp |
|-----|-------------|--------------------------|
| hindsight | `hindsight_recall`, `hindsight_retain` | Never use `skill_mcp(mcp_name="hindsight", ...)` |
| openmemory | `openmemory_query`, `openmemory_store` | Never use `skill_mcp(mcp_name="openmemory", ...)` |
| serena | `serena_*` tools | Never use `skill_mcp(mcp_name="serena", ...)` |

### Skill-Embedded MCPs (use skill_mcp)

These require `skill(name="...")` first, then `skill_mcp`:

| MCP | Example Call |
|-----|--------------|
| context7 | `skill_mcp(mcp_name="context7", tool_name="resolve-library-id", ...)` |
| websearch | `skill_mcp(mcp_name="websearch", tool_name="websearch_web_search_exa", ...)` |

### Why This Matters

Using `skill_mcp` for native MCPs produces:
```
"hindsight" is a builtin MCP, not a skill MCP.
Use the native tools directly: hindsight_recall, hindsight_retain, ...
```

The `skill_mcp` tool already detects this and provides helpful hints.
