import type { BuiltinSkill } from "../types"

export const toolDocFdSkill: BuiltinSkill = {
  name: "tool-doc-fd",
  description: "Power-user fd flags: hidden files, exclude patterns, parallel execution.",
  template: `## When to use

When constructing \`fd\` commands for file discovery that need flags beyond basic \`fd PATTERN\`.

## Key Flags

| Flag | Purpose |
|---|---|
| \`-H\` | Include hidden and dot files |
| \`-E PATTERN\` | Exclude by pattern (for example \`-E node_modules\`, \`-E "*.log"\`) |
| \`-e EXT\` | Filter by extension (for example \`-e py\`, \`-e ts\`) |
| \`-t f\` | Files only |
| \`-t d\` | Directories only |
| \`-t l\` | Symlinks only |
| \`-x CMD\` | Execute command per result (parallel) |
| \`-X CMD\` | Execute command with all results as args |
| \`-d N\` | Max search depth |
| \`--full-path\` | Match pattern against full path |
| \`-0\` | Null-delimited output |

## Syntax Tips

- \`fd\` uses regex-like patterns by default.
- \`fd\` is case-insensitive by default; use \`-s\` for case-sensitive.
- \`fd\` respects \`.gitignore\` by default; use \`-I\` or \`--no-ignore\` to override.

## Composite Examples

\`\`\`bash
# Find all .ts files and search each file
fd -e ts -x rg "interface.*Props"

# Find .log files and pass all to rm
fd -e log -X rm
\`\`\``,
}
