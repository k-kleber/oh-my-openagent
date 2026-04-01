import type { LoadedSkill } from "./types"

/**
 * Reserved names that specialist aliases and canonical names cannot collide with.
 * Includes built-in category names and built-in subagent names.
 */
export const RESERVED_NAMES = new Set([
  // Built-in Categories
  "visual-engineering",
  "ultrabrain",
  "deep",
  "artistry",
  "quick",
  "focused",
  "unspecified-low",
  "unspecified-high",
  "writing",

  // Built-in Subagents
  "sisyphus",
  "hephaestus",
  "debugger",
  "brainstormer",
  "researcher",
  "writer",
  "oracle",
  "librarian",
  "explore",
  "multimodal-looker",
  "metis",
  "momus",
  "atlas",
  "sisyphus-junior",
  "memory-retrieval",
  "memory-store"
])

export interface CollisionError {
  name: string
  source: string
  type: "reserved" | "duplicate"
  collidingWith?: string
}

/**
 * Validates a list of skills for specialist name/alias collisions.
 * Throws an error if a collision is found, providing actionable details.
 */
export function validateSpecialistCollisions(skills: LoadedSkill[]): void {
  const seenAliases = new Map<string, string>() // alias -> skill name (source)

  for (const skill of skills) {
    if (!skill.specialist) continue

    const specialist = skill.specialist
    const skillSource = skill.resolvedPath || skill.path || skill.name
    const effectiveName = specialist.name || skill.name
    const effectiveLower = effectiveName.toLowerCase()
    
    if (RESERVED_NAMES.has(effectiveLower)) {
      throw new Error(
        `Specialist validation failed: Specialist "${effectiveName}" in skill "${skill.name}" (${skillSource}) collides with a reserved built-in category or agent name.`
      )
    }

    if (seenAliases.has(effectiveLower)) {
      throw new Error(
        `Specialist validation failed: Specialist "${effectiveName}" in skill "${skill.name}" (${skillSource}) collides with an alias or name already defined in "${seenAliases.get(effectiveLower)}".`
      )
    }
    seenAliases.set(effectiveLower, skill.name)

    // Check aliases
    if (specialist.aliases) {
      for (const alias of specialist.aliases) {
        const lowerAlias = alias.toLowerCase()

        if (RESERVED_NAMES.has(lowerAlias)) {
          throw new Error(
            `Specialist validation failed: Specialist alias "${alias}" in skill "${skill.name}" (${skillSource}) collides with a reserved built-in category or agent name.`
          )
        }

        if (seenAliases.has(lowerAlias)) {
          throw new Error(
            `Specialist validation failed: Specialist alias "${alias}" in skill "${skill.name}" (${skillSource}) collides with an alias or name already defined in "${seenAliases.get(lowerAlias)}".`
          )
        }
        seenAliases.set(lowerAlias, skill.name)
      }
    }
  }
}
