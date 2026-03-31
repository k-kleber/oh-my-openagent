import { existsSync } from "node:fs"
import { CHECK_IDS, CHECK_NAMES } from "../constants"
import type { CheckResult, DoctorIssue } from "../types"
import { readMemoryMetricsSummary } from "../../../hooks/memory-auto-trigger/persistent-metrics"

export async function checkMemory(): Promise<CheckResult> {
  const issues: DoctorIssue[] = []
  const summary = readMemoryMetricsSummary()

  if (!existsSync(summary.metricsFilePath)) {
    issues.push({
      title: "Memory metrics file missing",
      description: "No persistent memory metrics file found yet. This may be normal before memory activity occurs.",
      severity: "warning",
      affects: ["memory observability"],
    })
  }

  return {
    name: CHECK_NAMES[CHECK_IDS.MEMORY],
    status: issues.length > 0 ? "warn" : "pass",
    message: issues.length > 0 ? "Memory system has observability warnings" : "Memory observability is healthy",
    details: [
      `Sessions tracked: ${summary.sessionCount}`,
      `Promotion threshold hits: ${summary.totalPromotionThresholdHits}`,
      `Auto captures: ${summary.totalAutoCaptures}`,
      `Metrics file: ${summary.metricsFilePath}`,
    ],
    issues,
  }
}
