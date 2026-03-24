import type { BuiltinSkill } from "../types"

export const fastcodeSkill: BuiltinSkill = {
  name: "fastcode",
  description: "FastCode MCP — repo-level code understanding with hybrid retrieval + LLM. Use for discovery, navigation, and answering questions about unfamiliar codebases.",
  template: `# FastCode MCP

Repo-level code understanding with hybrid retrieval + LLM.

## MCP Endpoint

- **URL**: \`http://localhost:5555/mcp\`
- **Transport**: \`streamable-http\`

## Available Tools

| Tool | Purpose |
| ---- | ------- |
| \`code_qa(question, repos)\` | Ask source-backed code questions |
| \`list_sessions()\` | List existing conversation sessions |
| \`get_session_history(session_id)\` | Retrieve conversation history |
| \`list_indexed_repos()\` | Show indexed repos |
| \`search_symbol(symbol_name, repos)\` | Find symbol definitions |
| \`get_repo_structure(repo_name)\` | Show repo summary/tree |
| \`get_file_summary(file_path, repos)\` | Show file stats |
| \`get_call_chain(symbol_name, repos)\` | Trace callers/callees |
| \`reindex_repo(repo_source)\` | Force re-index |

## Core Workflows

### 1. Understanding an Unfamiliar Codebase

\`\`\`typescript
get_repo_structure("myproject");
get_file_summary("src/main.py", ["."]);
code_qa("How does auth work?", ["."]);
\`\`\`

### 2. Finding Symbols

\`\`\`typescript
search_symbol("AuthService", ["."], "class");
get_call_chain("validate_token", ["."], "both");
\`\`\`

## Usage Patterns

- Always pass \`repos\` explicitly.
- For current project: \`repos=["."]\`
- Use \`multi_turn=true\` for iterative exploration.
- Use \`search_symbol\` before deep \`code_qa\` for faster grounding.

## Index Management

\`\`\`typescript
list_indexed_repos();
reindex_repo(".");
delete_repo_metadata("myproject");
\`\`\``,
  mcpConfig: {
    fastcode: { type: "http", url: "http://localhost:5555/mcp" },
  },
}
