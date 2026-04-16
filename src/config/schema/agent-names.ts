import { z } from "zod"

export const BuiltinAgentNameSchema = z.enum([
  "sisyphus",
  "hephaestus",
  "debugger",
  "tester",
  "brainstormer",
  "researcher",
  "writer",
  "prometheus",
  "oracle",
  "librarian",
  "explore",
  "deep-explorer",
  "multimodal-looker",
  "metis",
  "momus",
  "atlas",
  "sisyphus-junior",
  "memory-retrieval",
  "memory-store",
])

export const BuiltinSkillNameSchema = z.enum([
  "playwright",
  "agent-browser",
  "dev-browser",
  "frontend-ui-ux",
  "git-master",
  "code-intelligence-init",
  "memory-mcp",
  "memory-capture",
  "memory-recall-and-verify",
  "memory-auto",
  "memory-bootstrap-collector",
  "memory-project-bootstrap",
  "memory-init",
  "memory-promote",
  "memory-pre-compaction",
  "memory-observation-ledger",
  "global-tooling-preference",
  "tool-doc-ripgrep",
  "tool-doc-fd",
  "tool-doc-sd",
  "context7-mcp",
  "websearch-mcp",
])

export const OverridableAgentNameSchema = z.enum([
  "build",
  "plan",
  "sisyphus",
  "hephaestus",
  "debugger",
  "tester",
  "brainstormer",
  "researcher",
  "writer",
  "sisyphus-junior",
  "OpenCode-Builder",
  "prometheus",
  "metis",
  "momus",
  "oracle",
  "librarian",
  "explore",
  "deep-explorer",
  "multimodal-looker",
  "atlas",
  "memory-retrieval",
  "memory-store",
])

export const AgentNameSchema = BuiltinAgentNameSchema
export type AgentName = z.infer<typeof AgentNameSchema>

export type BuiltinSkillName = z.infer<typeof BuiltinSkillNameSchema>
