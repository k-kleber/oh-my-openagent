import type { LoadedSkill } from "./types"
import { validateSpecialistCollisions } from "./specialist-validation"

export function deduplicateSkillsByName(skills: LoadedSkill[]): LoadedSkill[] {
  validateSpecialistCollisions(skills)
  const seen = new Set<string>()
  const result: LoadedSkill[] = []
  for (const skill of skills) {
    if (!seen.has(skill.name)) {
      seen.add(skill.name)
      result.push(skill)
    }
  }
  return result
}
