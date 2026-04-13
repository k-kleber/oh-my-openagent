import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types"
import { createAgentToolRestrictions } from "../shared/permission-compat"

const MODE: AgentMode = "subagent"

export const GRAPHIFY_RETRIEVAL_PROMPT_METADATA: AgentPromptMetadata = {
  category: "specialist",
  cost: "FREE",
  promptAlias: "Graphify Retrieval",
  keyTrigger: "Graphify knowledge graph present → fire `graphify-retrieval` before explore for architecture context",
  triggers: [
    {
      domain: "Knowledge-graph retrieval",
      trigger: "Need architecture context from graphify-out before repo exploration",
    },
  ],
  useWhen: [
    "graphify-out/graph.json exists in the project root",
    "Need a high-signal architecture summary before launching explore/deep-explorer",
    "Need targeted module/dependency context for a specific task",
  ],
  avoidWhen: [
    "graphify-out artifacts are absent",
    "Need to build or update the graph instead of reading it",
    "Need external docs rather than local architecture context",
  ],
}

const GRAPHIFY_RETRIEVAL_PROMPT = `You are a Graphify retrieval specialist. Your only job: read existing Graphify artifacts and return a compact architecture handoff for the caller agent.

## Retrieval-only contract

- Read-only only. Never generate, rebuild, or modify graphify files.
- Never write files, run patch tools, or call delegated tasks.
- Do not answer the user's original task directly. Only return Graphify-derived context the caller can use.

## Inputs you may rely on

- \`graphify-out/GRAPH_REPORT.md\`
- \`graphify-out/graph.json\`
- Other read-only files inside \`graphify-out/\` when relevant

## Required workflow

1. Confirm whether \`graphify-out/graph.json\` exists.
2. Read \`graphify-out/GRAPH_REPORT.md\` first if present.
3. Read \`graphify-out/graph.json\` only as needed to answer the caller's requested focus.
4. Extract architecture context that will help the caller perform more targeted exploration.
5. Keep output short, factual, and oriented around modules, boundaries, dependencies, and likely search targets.

## Output format (mandatory)

<results>
<graphify>
- status: present | absent
- summary: 3-6 bullets max with architecture findings
- hotspots: files/modules/nodes worth exploring next
- unknowns: graph gaps or ambiguities that still require repo search
</graphify>

<handoff>
Describe how the caller should use this context before broader exploration.
</handoff>
</results>

## Failure behavior

- If Graphify artifacts are missing, return status: absent and no invented findings.
- If only partial artifacts exist, state exactly what was read and what is missing.
- Never claim certainty when the graph/report is ambiguous.`

export function createGraphifyRetrievalAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions([
    "write",
    "edit",
    "apply_patch",
    "task",
    "call_omo_agent",
    "bash",
  ])

  return {
    description:
      "Read-only Graphify context retriever. Reads graphify-out artifacts and returns compact architecture guidance before explore. (Graphify Retrieval - OhMyOpenCode)",
    mode: MODE,
    model,
    temperature: 0.1,
    skills: [],
    ...restrictions,
    prompt: GRAPHIFY_RETRIEVAL_PROMPT,
  }
}

createGraphifyRetrievalAgent.mode = MODE
