import type { BuiltinSkill } from "../types"

export const toolDocRipgrepSkill: BuiltinSkill = {
  name: "tool-doc-ripgrep",
  description: "Power-user ripgrep (rg) flags: smart case, vimgrep output, glob filtering, hidden file search.",
  template: `## When to use

When constructing \`rg\` commands that need flags beyond basic \`rg PATTERN\`.

## Key Flags

| Flag | Purpose |
|---|---|
| \`-S\` | Smart case: case-insensitive unless pattern has uppercase |
| \`--vimgrep\` | Parser-friendly output: \`file:line:col:match\` |
| \`-g GLOB\` | Include/exclude by glob (for example \`-g "*.ts"\`, \`-g "!*.min.js"\`) |
| \`--hidden\` | Search hidden and dot files |
| \`-n\` | Show line numbers |
| \`-c\` | Count matches per file |
| \`-l\` | List files with matches only |
| \`--no-ignore\` | Ignore .gitignore rules |
| \`-t TYPE\` | Filter by built-in file type (for example \`-t py\`, \`-t js\`) |
| \`-A/-B/-C N\` | After, before, or context lines around matches |

## Performance Notes

- \`rg\` respects \`.gitignore\` by default. Use \`--no-ignore\` to override.
- \`rg\` skips binary files by default.
- Prefer \`-t TYPE\` over \`-g "*.ext"\` for common languages.

## Composite Examples

\`\`\`bash
# Pipe fd results into rg
fd -e py -x rg "def main"

# Search only JS/TS with vimgrep output
rg --vimgrep -t js -t ts "TODO|FIXME"
\`\`\``,
}
