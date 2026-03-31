import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { getOmoOpenCodeCacheDir } from "../../shared"
import { writeJsonAtomic } from "../../features/claude-tasks/storage"
import type { MemoryMetricsState } from "./metrics"

const PersistentMemoryMetricsEntrySchema = z.object({
    observationsCaptured: z.number(),
    retrievalHits: z.number(),
    reducerEligibleEvents: z.number(),
    reducerCandidatesSuggested: z.number(),
    autoCapturesTriggered: z.number(),
    lifecycleCapturesTriggered: z.number(),
    promotionCandidatesSuggested: z.number(),
    promotionThresholdHits: z.number(),
    memoryTaskResets: z.number(),
    updatedAt: z.string(),
})

const PersistentMemoryMetricsSchema = z.object({
  sessions: z.record(z.string(), PersistentMemoryMetricsEntrySchema),
})

type PersistentMemoryMetrics = z.infer<typeof PersistentMemoryMetricsSchema>

function getMetricsFilePath(): string {
  return join(getOmoOpenCodeCacheDir(), "memory", "memory-metrics.json")
}

function readPersistentMetrics(): PersistentMemoryMetrics {
  const filePath = getMetricsFilePath()
  try {
    if (!existsSync(filePath)) {
      return { sessions: {} }
    }

    const content = readFileSync(filePath, "utf-8")
    const parsed = JSON.parse(content)
    const result = PersistentMemoryMetricsSchema.safeParse(parsed)
    if (result.success) {
      return result.data
    }
  } catch {
  }
  return { sessions: {} }
}

export function persistMemoryMetrics(sessionID: string, metrics: MemoryMetricsState): void {
  const filePath = getMetricsFilePath()
  const dir = join(getOmoOpenCodeCacheDir(), "memory")
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const existing = readPersistentMetrics()
  existing.sessions[sessionID] = {
    ...metrics,
    updatedAt: new Date().toISOString(),
  }
  writeJsonAtomic(filePath, existing)
}

export function readMemoryMetricsSummary(): {
  sessionCount: number
  totalPromotionThresholdHits: number
  totalAutoCaptures: number
  metricsFilePath: string
} {
  const existing = readPersistentMetrics()
  const sessions = Object.values(existing.sessions)
  return {
    sessionCount: sessions.length,
    totalPromotionThresholdHits: sessions.reduce((sum: number, item) => sum + item.promotionThresholdHits, 0),
    totalAutoCaptures: sessions.reduce((sum: number, item) => sum + item.autoCapturesTriggered, 0),
    metricsFilePath: getMetricsFilePath(),
  }
}
