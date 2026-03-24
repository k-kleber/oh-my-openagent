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
- Pre-warm LSP cache: \`serena_execute_shell_command(command="serena project index <projectName> --language <language>")\`.

### 3. Initialize Hindsight bank

\`\`\`
skill_mcp(mcp_name="hindsight", tool_name="list_banks", arguments={})
\`\`\`
If bank doesn't exist:
\`\`\`
skill_mcp(mcp_name="hindsight", tool_name="create_bank", arguments={"bank_id": "<bankId>", "name": "<projectName>", "mission": "Temporal memory for <projectName>"})
\`\`\`

### 4. Scope OpenMemory

\`\`\`
skill_mcp(mcp_name="openmemory", tool_name="openmemory_store", arguments={"content": "Project container initialized: <projectName>.", "tags": ["project:<projectName>"], "metadata": {"type": "project-config", "scope": "project"}})
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
- Use \`skill_mcp\` for Hindsight and OpenMemory.`,
  mcpConfig: {
    hindsight: { type: "http", url: "http://localhost:8888/mcp" },
    openmemory: { type: "http", url: "http://localhost:8080/mcp", headers: { "x-api-key": "local-dev-key" } },
  },
}
