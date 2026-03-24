import type { BuiltinSkill } from "./types"
import type { BrowserAutomationProvider } from "../../config/schema"

import {
  playwrightSkill,
  agentBrowserSkill,
  playwrightCliSkill,
  frontendUiUxSkill,
  gitMasterSkill,
  devBrowserSkill,
  codeIntelligenceSkill,
  fastcodeSkill,
  memoryMcpSkill,
  memoryCaptureSkill,
  memoryRecallAndVerifySkill,
  memoryAutoSkill,
  memoryBootstrapCollectorSkill,
  memoryProjectBootstrapSkill,
  memoryInitSkill,
  memoryPromoteSkill,
  memoryPreCompactionSkill,
  globalToolingPreferenceSkill,
} from "./skills/index"

export interface CreateBuiltinSkillsOptions {
  browserProvider?: BrowserAutomationProvider
  disabledSkills?: Set<string>
}

export function createBuiltinSkills(options: CreateBuiltinSkillsOptions = {}): BuiltinSkill[] {
  const { browserProvider = "playwright", disabledSkills } = options

  let browserSkill: BuiltinSkill
  if (browserProvider === "agent-browser") {
    browserSkill = agentBrowserSkill
  } else if (browserProvider === "playwright-cli") {
    browserSkill = playwrightCliSkill
  } else {
    browserSkill = playwrightSkill
  }

  const skills = [
    browserSkill,
    codeIntelligenceSkill,
    fastcodeSkill,
    globalToolingPreferenceSkill,
    frontendUiUxSkill,
    gitMasterSkill,
    devBrowserSkill,
    memoryMcpSkill,
    memoryCaptureSkill,
    memoryRecallAndVerifySkill,
    memoryAutoSkill,
    memoryBootstrapCollectorSkill,
    memoryProjectBootstrapSkill,
    memoryInitSkill,
    memoryPromoteSkill,
    memoryPreCompactionSkill,
  ]

  if (!disabledSkills) {
    return skills
  }

  return skills.filter((skill) => !disabledSkills.has(skill.name))
}
