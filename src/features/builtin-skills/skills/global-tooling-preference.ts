import type { BuiltinSkill } from "../types"

export const globalToolingPreferenceSkill: BuiltinSkill = {
  name: "global-tooling-preference",
  description: "Performance-first CLI: always prefer Rust/Go tools (rg, fd, sd, bat) over POSIX equivalents (grep, find, sed, cat).",
  template: `# Global Tooling Preference

ALWAYS — this is the default decision layer for any filesystem traversal, text search, stream edit, or file view operation.

## Directive

Prioritize modern Rust/Go-based tools over POSIX standards.

| Task | Use | Instead of |
|---|---|---|
| Search text | \`rg\` | \`grep\` |
| Find files | \`fd\` | \`find\` |
| Edit streams | \`sd\` | \`sed\` |
| View files | \`bat\` | \`cat\` |

## Logic

1. Identify the task: search, find, edit, or view.
2. Use the mapped tool directly.
3. If unfamiliar syntax is needed, load the corresponding \`tool-doc-*\` skill.
4. Only fall back to POSIX tools if the modern equivalent is not installed.

## Guardrails

- Never generate \`grep\`, \`find\`, \`sed\`, or \`cat\` commands unless the modern tool is confirmed absent.
- For composite operations (pipe fd → rg), consult the relevant tool-doc skill for flag compatibility.
- Never reproduce full tool documentation inline — output only the specific command needed.`,
}
