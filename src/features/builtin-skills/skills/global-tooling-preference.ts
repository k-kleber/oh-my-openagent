import type { BuiltinSkill } from "../types"

export const globalToolingPreferenceSkill: BuiltinSkill = {
  name: "global-tooling-preference",
  description: "Performance-first tool selection: prefer high-fidelity wrappers first, and modern Rust/Go CLIs for raw shell workflows.",
  template: `# Global Tooling Preference

ALWAYS — this is the default decision layer for any filesystem traversal, text search, stream edit, or file view operation.

## Directive

Prioritize the highest-fidelity tools available in the current session.

- If the session exposes abstract tools such as \`grep\`, \`glob\`, or \`ast_grep_search\`, use those tool names directly.
- Treat those wrappers as the preferred interface because they already route to fast local backends when available.
- If you are writing raw shell commands, prefer modern Rust/Go-based CLIs over POSIX standards.

| Task | Preferred wrapper/tool | Backend preference |
|---|---|---|
| Search text | \`grep\` or \`ast_grep_search\` | Prefer ripgrep-style execution when available |
| Find files | \`glob\` | Prefer fd-style file discovery when available |
| Edit streams | Native edit/write tools | Prefer \`sd\` over \`sed\` for raw shell workflows |
| View files | Native read tools | Prefer \`bat\` over \`cat\` for raw shell workflows |

## Backend Mapping

- \`grep\` is the preferred session tool for text search and may be backed by \`rg\` internally.
- \`glob\` is the preferred session tool for file discovery and may replace direct \`fd\`/\`find\` usage.
- \`ast_grep_search\` is preferred over plain text search when structural matching is available.
- Only use literal \`rg\`, \`fd\`, \`sd\`, or \`bat\` when the session actually exposes a shell/command tool and emitting a raw command is appropriate.

## Logic

1. Identify the task: search, find, edit, or view.
2. Check whether the session exposes abstract tools or expects raw shell commands.
3. Use the session tool name directly when a wrapper exists.
4. If you must emit a shell command, prefer \`rg\`/\`fd\`/\`sd\`/\`bat\` over POSIX equivalents.
5. If unfamiliar syntax is needed, load the corresponding \`tool-doc-*\` skill.
6. Only fall back to POSIX tools if the modern equivalent is not installed.

## Guardrails

- Never invent raw command names when the session only exposes abstract tool names.
- Never bypass \`grep\`/\`glob\`/\`ast_grep_search\` wrappers just to force literal \`rg\` or \`fd\` usage.
- For raw shell composite operations (pipe fd → rg), consult the relevant \`tool-doc-*\` skill for flag compatibility.
- Never reproduce full tool documentation inline — output only the specific command needed.`,
}
