export type MemoryScope = "project" | "system" | "framework" | "global" | "user"

export interface MemoryObservationCandidate {
  insight: string
  confidence: number
  evidenceCount: number
  dedupeKey: string
  promote: boolean
  scope: MemoryScope
}

export interface MemoryStoreInput {
  sessionID: string
  projectPath: string
  projectName: string
  reason: string
  scope: MemoryScope
  allowedScopes: MemoryScope[]
  observations: string[]
  confidenceThreshold: number
  promotionThreshold: number
  crossProjectEvidenceMin: number
}

export interface MemoryStoreResult {
  stored: MemoryObservationCandidate[]
  deduped: MemoryObservationCandidate[]
  contradicted: MemoryObservationCandidate[]
  promoted: MemoryObservationCandidate[]
}

export type MemoryVerificationStatus = "verified" | "partially_verified" | "likely-valid" | "stale" | "contradicted" | "unverifiable"

export interface MemoryRecallItem {
  content: string
  source: "hindsight" | "openmemory"
  score: number
  scope: MemoryScope
  verification: MemoryVerificationStatus
  evidence?: {
    path?: string
    line?: number
    snippet?: string
  }
}

export interface MemoryRecallInput {
  sessionID: string
  projectPath: string
  projectName: string
  query: string
  scope: MemoryScope
  agentName?: string
  recentTools?: string[]
}

export interface MemoryRecallResult {
  items: MemoryRecallItem[]
  hits: number
}
