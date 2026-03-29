import type { BuiltinSkill } from "../types"

export const toolDocSdSkill: BuiltinSkill = {
  name: "tool-doc-sd",
  description: "Power-user sd flags: regex stream editing without sed's escaping nightmare.",
  template: `## When to use

When constructing \`sd\` commands for in-place file editing or piped stream transforms.

## Key Flags

| Flag | Purpose |
|---|---|
| \`sd 'FIND' 'REPLACE' FILE\` | Basic in-place edit |
| \`-p\` | Preview changes without writing |
| \`-f\` | Fixed-string mode (no regex) |
| \`-n\` | Print matched lines only |

## Advantages over sed

- No slash escaping complexity for common replacements.
- Replaces all occurrences by default.
- Regex engine supports Unicode.
- Capture groups use \`$1\`, \`$2\`.

## Syntax

\`\`\`bash
# Basic replacement
sd 'old_pattern' 'new_pattern' file.txt

# Regex with capture groups
sd 'v(\\d+\\.\\d+)' 'version=$1' changelog.md

# Preview mode
sd -p 'foo' 'bar' config.yaml

# Pipe mode
echo "hello world" | sd 'world' 'universe'

# Fixed string mode
sd -f 'C:\\Users' '/home/user' paths.txt
\`\`\``,
}
