import type { BuiltinSkill } from "../types"

export const codeIntelligenceSkill: BuiltinSkill = {
  name: "code-intelligence",
  description: "Serena-first code intelligence for repo navigation, symbol tracing, and precise edits.",
  template: `# Code Intelligence

Any request about what code does, how symbols are connected, or how a module is wired.

## Workflow

### Phase 1: Serena project activation

- Use \`serena_activate_project\` for the current project before deep analysis.
- Start with \`get_symbols_overview\`, \`find_symbol\`, and \`find_referencing_symbols\` when the code area is unknown.
- Use Serena search tools to narrow to the right module before reading files broadly.

### Phase 2: Precision analysis

- Use \`find_symbol\`, \`find_referencing_symbols\`, and \`get_symbols_overview\` for deep, symbol-level understanding.
- Use structural and lexical fallbacks only when Serena cannot answer directly: \`lsp_*\`, \`ast_grep_*\`, \`grep\`, and \`glob\`.
- Safely edit code at the symbol level using Serena symbol-editing tools when they fit the change.

## Guardrails

- Serena is the default discovery and validation path.
- Do NOT guess symbol locations — use Serena symbol search first when the path is unknown.
- If Serena is unavailable, fall back to \`lsp_*\`, \`ast_grep_*\`, \`grep\`, and \`glob\` in that order.`,
}
