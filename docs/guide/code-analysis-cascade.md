# Code Analysis Cascade (FastCode + Serena + AST/LSP + grep)

This guide defines the default analysis cascade used for deep code traversal.

## Default execution order

1. FastCode scout
2. Serena symbol pass
3. AST/LSP precision pass
4. grep/ripgrep fallback

Use this order for code-understanding tasks. Do not start with broad grep when higher-fidelity tools are available.

## Why this order

- FastCode is fast for repo-wide discovery and narrowing scope.
- Serena provides symbol-level precision for definitions/references and safe boundary mapping.
- AST/LSP validates structure and semantic edges.
- grep/ripgrep is best as a final lexical catch-all.

## Runtime fallback policy

- If FastCode is unavailable: start at Serena.
- If Serena is unavailable: use AST/LSP directly.
- If AST/LSP is unavailable: use grep/glob and mark confidence as degraded.

## Explore defaults

When `task(subagent_type="explore", load_skills=[])` is used, default skills are injected by delegate-task:

- `code-intelligence`
- `global-tooling-preference`
- `fastcode`

Only skills present in `availableSkills` are injected.

Code path:

- `src/tools/delegate-task/tools.ts`
- `src/tools/delegate-task/types.ts` (`defaultSkillsBySubagent`)

## Skill source precedence

For same-named skills, precedence is first match by discovery order:

1. `.opencode/skills` (project)
2. `~/.config/opencode/skills` (opencode global)
3. `.claude/skills` and `.agents/skills` (project)
4. `~/.claude/skills` and `~/.agents/skills` (user)
5. built-in skills (fallback)

Loader references:

- `src/features/opencode-skill-loader/loader.ts`
- `src/features/opencode-skill-loader/skill-discovery.ts`
- `src/features/opencode-skill-loader/merger.ts`

## Capability matrix

| Goal | Primary | Secondary | Fallback |
|---|---|---|---|
| Global module discovery | FastCode | Serena symbols | glob + grep |
| Definition/reference tracing | Serena (symbol tools) | LSP tools | grep patterns |
| Structural code pattern search | ast_grep_search | LSP symbols | grep regex |
| Safe rename/refactor prep | LSP (`prepare_rename`, refs) | Serena symbols | manual grep + review |
| Text literals / logs / comments | grep | ast_grep_search | glob + read |
