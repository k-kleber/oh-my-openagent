import type { BuiltinSkill } from "../types"

export const codeIntelligenceSkill: BuiltinSkill = {
  name: "code-intelligence",
  description: "Two-Phase Intelligence: FastCode for global scouting + Serena for precision LSP analysis.",
  template: `# Code Intelligence

Any request about what code does, how symbols are connected, or how a module is wired.

## Workflow

### Phase 1: Global Scouting (FastCode)

- Use \`fastcode\` for wide-area discovery across the entire workspace.
- Locate specific logic, identify relevant project folders, and get high-level summaries.
- "Scout" first to avoid reading irrelevant files or guessing paths.

### Phase 2: Precision Analysis (Serena)

- Once FastCode identifies the relevant paths, use \`serena\` to "Activate" the project.
- Use \`find_symbol\`, \`find_referencing_symbols\`, and \`get_symbols_overview\` for deep, symbol-level understanding.
- Safely edit code at the symbol level using \`replace_symbol\`.

## Guardrails

- Use FastCode to **Locate**, Serena to **Contextualize** and **Validate**.
- FastCode ignores \`build/\` and \`devel/\` — always rely on source headers found by the Scout.
- Do NOT guess symbol locations — always scout first if the path is unknown.`,
}
