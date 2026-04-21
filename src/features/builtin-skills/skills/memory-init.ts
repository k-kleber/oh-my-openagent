import type { BuiltinSkill } from "../types"

export const memoryInitSkill: BuiltinSkill = {
  name: "memory-init",
  description: "Session initializer: activates Serena for the current project, ensures Hindsight bank exists, and scopes OpenMemory to the project.",
  template: `# Memory Init

At the start of a project session: "init memory", "set up memory for this project".

## Workflow

### 1. Identify the project

- Current project name from working directory (e.g. \`opencode\` from \`/home/kevin/.dotfiles/opencode\`).
- Use kebab-case for Hindsight bank IDs.

### 2. Activate Serena

- Call \`serena_activate_project(project="<projectName>")\`.
- Note detected languages.
- Keep Serena setup in the native tool interface. Do not express it as a shell command.

### 2.a Verify Serena readiness

- Verify Serena activation for this project.
- If Serena is not ready, run:
\`\`\`
skill(name="code-intelligence-init", user_message="Initialize Serena for this project")
\`\`\`
- After bootstrap, re-check Serena readiness and continue memory setup.

### 3. Initialize Hindsight bank

\`\`\`
hindsight_list_banks({})
\`\`\`
If bank doesn't exist:
\`\`\`
hindsight_create_bank({"bank_id": "<bankId>", "name": "<projectName>", "mission": "Temporal memory for <projectName>"})
\`\`\`

### 4. Scope OpenMemory

\`\`\`
openmemory_store({"content": "Project container initialized: <projectName>.", "tags": ["project:<projectName>"], "metadata": {"type": "project-config", "scope": "project"}})
\`\`\`

### 5. Report status

\`\`\`
Memory initialized for project: <projectName>
- Serena: activated + indexed
- Hindsight: <created|existing> (bank_id: <bankId>)
- OpenMemory: container active
\`\`\`

## Guardrails

- Use kebab-case for bank IDs.
- Use \`hindsight_*\` and \`openmemory_*\` native tools.
- Never express Serena tool usage as shell commands.
- Run \`code-intelligence-init\` when Serena readiness is missing.`,
}
