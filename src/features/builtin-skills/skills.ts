import type { BuiltinSkill } from "./types"
import type { BrowserAutomationProvider } from "../../config/schema"
import type { WebsearchConfig } from "../../config/schema"

import {
  playwrightSkill,
  agentBrowserSkill,
  playwrightCliSkill,
  frontendUiUxSkill,
  gitMasterSkill,
  devBrowserSkill,
  codeIntelligenceSkill,
  codeIntelligenceInitSkill,
  memoryMcpSkill,
  memoryCaptureSkill,
  memoryRecallAndVerifySkill,
  memoryAutoSkill,
  memoryBootstrapCollectorSkill,
  memoryProjectBootstrapSkill,
  memoryInitSkill,
  memoryPromoteSkill,
  memoryPreCompactionSkill,
  memoryObservationLedgerSkill,
  globalToolingPreferenceSkill,
  toolDocRipgrepSkill,
  toolDocFdSkill,
  toolDocSdSkill,
  context7McpSkill,
  createWebsearchMcpSkill,
} from "./skills/index"

export interface CreateBuiltinSkillsOptions {
  browserProvider?: BrowserAutomationProvider
  disabledSkills?: Set<string>
  websearchConfig?: WebsearchConfig
}

export function createBuiltinSkills(options: CreateBuiltinSkillsOptions = {}): BuiltinSkill[] {
  const { browserProvider = "playwright", disabledSkills, websearchConfig } = options

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
    codeIntelligenceInitSkill,
    globalToolingPreferenceSkill,
    toolDocRipgrepSkill,
    toolDocFdSkill,
    toolDocSdSkill,
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
    memoryObservationLedgerSkill,
    context7McpSkill,
    createWebsearchMcpSkill(websearchConfig),
  ]

  if (!disabledSkills) {
    return skills
  }

  return skills.filter((skill) => !disabledSkills.has(skill.name))
}
