import type { BuiltinSkill } from "../types"

export const codeIntelligenceInitSkill: BuiltinSkill = {
  name: "code-intelligence-init",
  description: "Initialize Serena and FastCode for the current project with bounded, timeout-aware startup behavior.",
  template: `# Code Intelligence Init

At project start: "init code intelligence", "setup serena and fastcode", "prepare code analysis".

## Goal

Make code-intelligence ready for this project without blocking forever on FastCode indexing.

## Workflow

### 1. Resolve project context

- Derive \`<projectName>\` from cwd.
- Use \`repos=["."]\` for FastCode operations on the current project.

### 2. Serena readiness (CLI-first)

Run:

\`\`\`
serena_activate_project(project="<projectName>")
serena_execute_shell_command(command="serena project index <projectName>")
\`\`\`

If this fails, stop and report \`FAILED\`. Do not continue to FastCode.

### 3. FastCode readiness probe

- Load FastCode skill: \`skill(name="fastcode")\`
- Probe index state: \`skill_mcp(mcp_name="fastcode", tool_name="list_indexed_repos", arguments={})\`

If the current project is not indexed, run:

\`\`\`
skill_mcp(mcp_name="fastcode", tool_name="reindex_repo", arguments={"repo_source":"."})
\`\`\`

If MCP reindex times out, use direct server fallback (FastCode local server):

\`\`\`bash
# API mode (recommended fallback)
python /home/kevin/workspace/opencode-mcp-servers/FastCode/api.py --host 0.0.0.0 --port 8000
curl -sS -X POST http://localhost:8000/load-and-index \\
  -H "Content-Type: application/json" \\
  -d '{"source":".","is_url":false}'
\`\`\`

Alternative CLI fallback:

\`\`\`bash
python /home/kevin/workspace/opencode-mcp-servers/FastCode/main.py index --repo-path .
\`\`\`

### 4. Timeout-aware retry window

If FastCode probe/index call times out:

- Retry probe with bounded backoff: 30s, 60s, 120s.
- Keep total FastCode wait bounded (target 5-10 minutes max).
- If still not ready, report \`SUCCESS_DEGRADED\` with reason \`DEGRADED_FASTCODE_INDEXING\` and proceed with Serena-only operation.

### 5. Status contract

Return one of:

- \`READY\`: Serena indexed and FastCode available.
- \`SUCCESS_DEGRADED\`: Serena indexed, FastCode still indexing or timed out.
- \`FAILED\`: Serena initialization failed.

## Guardrails

- Prefer CLI for Serena setup.
- Keep FastCode initialization idempotent and bounded; never hang indefinitely.
- Never block memory initialization forever waiting on FastCode.
- If MCP times out, fall back to direct FastCode API/CLI indexing.
- Always include explicit status and next action in the final report.`,
  mcpConfig: {
    fastcode: { type: "http", url: "http://localhost:5555/mcp" },
  },
}
