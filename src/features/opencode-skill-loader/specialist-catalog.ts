import type { LoadedSkill, AvailableSpecialist } from "./types"

/**
 * Extracts specialist information from loaded skills that contain specialist metadata.
 */
export function extractSpecialists(skills: LoadedSkill[]): AvailableSpecialist[] {
  return skills
    .filter((skill) => !!skill.specialist)
    .map((skill) => {
      const spec = skill.specialist!
      return {
        name: spec.name || skill.name,
        aliases: spec.aliases,
        description: spec.specialistDescription || skill.definition.description || "",
        composesSkills: spec.composesSkills,
        knowledgeSources: spec.knowledgeSources,
      }
    })
}

/**
 * Formats a list of available specialists into a human-readable catalog for prompts.
 */
export function formatSpecialistCatalog(specialists: AvailableSpecialist[]): string {
  if (specialists.length === 0) return ""

  const rows = specialists.map((spec) => {
    const aliasStr = spec.aliases && spec.aliases.length > 0 
      ? ` (aliases: ${spec.aliases.join(", ")})` 
      : ""
    const composeStr = spec.composesSkills && spec.composesSkills.length > 0
      ? ` [composed: ${spec.composesSkills.join(", ")}]`
      : ""
    const knowledgeStr = spec.knowledgeSources && spec.knowledgeSources.length > 0
      ? ` [sources: ${spec.knowledgeSources.join(", ")}]`
      : ""
    
    return `- \`${spec.name}\`${aliasStr} — ${spec.description}${composeStr}${knowledgeStr}`
  })

  return `### Specialist Agent Catalog

Specialists are domain-optimized configurations of base agents. Use them when your task fits their specific domain.

${rows.join("\n")}

> Specialists are descriptive guides for delegation. They help you know which skills and categories to combine.`
}
