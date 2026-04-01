import type { CommandDefinition } from "../claude-code-command-loader/types"
import type { SkillMcpConfig } from "../skill-mcp-manager/types"

export type SkillScope = "builtin" | "config" | "user" | "project" | "opencode" | "opencode-project"

export interface SpecialistMetadata {
  /** Canonical name of the specialist (e.g. "python-expert") */
  name?: string
  /** Aliases for triggering this specialist */
  aliases?: string[]
  /** Base agent to use (e.g. "sisyphus", "hephaestus") */
  baseAgent?: string
  /** Base category to target (e.g. "focused", "deep", "writing") */
  baseCategory?: string
  /** Skills to compose/fuse into this specialist */
  composesSkills?: string[]
  /** Knowledge sources to prioritize */
  knowledgeSources?: ("local-codebase" | "local-docs" | "web")[]
  /** Conditional add-on skills for language-specific helpers */
  conditionalAddOnSkills?: Record<string, string>
  /** Hint for future first-class-agent migration */
  promotionHint?: string
  /** Phrases that trigger this specialist in chat */
  triggerPhrases?: string[]
  /** Description for prompt exposure */
  specialistDescription?: string
}

export interface SkillMetadata {
  name?: string
  description?: string
  model?: string
  "argument-hint"?: string
  agent?: string
  subtask?: boolean
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  "allowed-tools"?: string | string[]
  mcp?: SkillMcpConfig
  /** Specialist metadata contract for advanced agents */
  specialist?: SpecialistMetadata
}

export interface LazyContentLoader {
  loaded: boolean
  content?: string
  load: () => Promise<string>
}

export interface AvailableSpecialist {
  name: string
  aliases?: string[]
  description: string
  composesSkills?: string[]
  knowledgeSources?: string[]
}

export interface LoadedSkill {
  name: string
  path?: string
  resolvedPath?: string
  definition: CommandDefinition
  scope: SkillScope
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  allowedTools?: string[]
  mcpConfig?: SkillMcpConfig
  lazyContent?: LazyContentLoader
  /** Specialist metadata contract for advanced agents */
  specialist?: SpecialistMetadata
}
