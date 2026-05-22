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
  codeIntelligenceInitSkill,
  createMemoryMcpSkill,
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
  createContext7McpSkill,
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
    codeIntelligenceInitSkill,
    globalToolingPreferenceSkill,
    toolDocRipgrepSkill,
    toolDocFdSkill,
    toolDocSdSkill,
    frontendUiUxSkill,
    gitMasterSkill,
    devBrowserSkill,
    createMemoryMcpSkill(),
    memoryCaptureSkill,
    memoryRecallAndVerifySkill,
    memoryAutoSkill,
    memoryBootstrapCollectorSkill,
    memoryProjectBootstrapSkill,
    memoryInitSkill,
    memoryPromoteSkill,
    memoryPreCompactionSkill,
    memoryObservationLedgerSkill,
    createContext7McpSkill(),
    createWebsearchMcpSkill(websearchConfig),
  ]

  if (!disabledSkills) {
    return skills
  }

  return skills.filter((skill) => !disabledSkills.has(skill.name))
}
