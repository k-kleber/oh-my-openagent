import type { BuiltinSkill } from "../types"

export const codeIntelligenceInitSkill: BuiltinSkill = {
  name: "code-intelligence-init",
  description: "Initialize Serena for the current project and run clangd preindex setup when applicable.",
  template: `# Code Intelligence Init

At project start: "init code intelligence", "setup serena", "prepare code analysis".

## Goal

Make Serena ready for this project and apply clangd preindex optimization when the project is C/C++ compatible.

## Workflow

### 1. Resolve project context

- Derive \`<projectName>\` from cwd.

### 2. Serena readiness (CLI-first)

Run:

\`\`\`
serena_activate_project(project="<projectName>")
serena_execute_shell_command(command="serena project index <projectName>")
\`\`\`

If this fails, stop and report \`FAILED\`.

### 3. Conditional clangd optimization

After Serena readiness, check if the project is clangd-compatible and run:

\`\`\`text
skill(name="clangd-preindex-init")
\`\`\`

Expected behavior from \`clangd-preindex-init\`:
- Detect C/C++ compatibility (\`*.cpp\`, \`compile_commands.json\`, \`.clangd\`, \`CMakeLists.txt\`).
- Set lightweight clangd options for short-lived agents.
- Prepare optional shared static/remote index flow for larger setups.

If the skill returns \`SKIPPED_NOT_CLANGD\`, continue normally.

### 4. Status contract

Return one of:

- \`READY\`: Serena indexed successfully (clangd step applied or skipped).
- \`FAILED\`: Serena initialization failed.

## Guardrails

- Prefer CLI for Serena setup.
- Always include explicit status and next action in the final report.`,
}
