import { z } from "zod"

const MemoryScopeSchema = z.enum(["project", "system", "framework", "global", "user"])

export const MemoryRetrievalConfigSchema = z.object({
  enabled: z.boolean().optional(),
  cooldown_ms: z.number().int().min(0).optional(),
  max_per_session: z.number().int().min(0).optional(),
  max_query_chars: z.number().int().min(1).optional(),
  run_in_background: z.boolean().optional(),
})

export const MemoryCaptureConfigSchema = z.object({
  enabled: z.boolean().optional(),
  cooldown_ms: z.number().int().min(0).optional(),
  max_per_session: z.number().int().min(0).optional(),
  min_output_chars: z.number().int().min(0).optional(),
  max_insights: z.number().int().min(1).optional(),
  max_insight_chars: z.number().int().min(1).optional(),
  run_in_background: z.boolean().optional(),
  discovery_tools: z.array(z.string()).optional(),
})

export const MemoryLifecycleConfigSchema = z.object({
  capture_on_session_idle: z.boolean().optional(),
  capture_on_session_compacted: z.boolean().optional(),
  capture_on_preemptive_compaction: z.boolean().optional(),
  idle_cooldown_ms: z.number().int().min(0).optional(),
})

export const MemoryBudgetConfigSchema = z.object({
  session_chars: z.number().int().min(1).optional(),
  pause_after_failures: z.number().int().min(1).optional(),
  failure_pause_ms: z.number().int().min(0).optional(),
})

export const MemoryTaxonomyConfigSchema = z.object({
  enabled: z.boolean().optional(),
  default_scope: MemoryScopeSchema.optional(),
  allowed_scopes: z.array(MemoryScopeSchema).optional(),
})

export const MemoryObservationLedgerConfigSchema = z.object({
  enabled: z.boolean().optional(),
  max_entries_per_session: z.number().int().min(1).optional(),
  sample_window: z.number().int().min(1).optional(),
  min_output_chars: z.number().int().min(0).optional(),
  capture_tool_inputs: z.boolean().optional(),
})

export const MemoryReducerConfigSchema = z.object({
  enabled: z.boolean().optional(),
  confidence_threshold: z.number().min(0).max(1).optional(),
  promotion_threshold: z.number().min(0).max(1).optional(),
  min_evidence_count: z.number().int().min(1).optional(),
  cross_project_evidence_min: z.number().int().min(1).optional(),
  run_on_lifecycle_events: z.boolean().optional(),
  run_on_tool_capture: z.boolean().optional(),
})

export const MemoryObservabilityConfigSchema = z.object({
  enabled: z.boolean().optional(),
  log_metrics: z.boolean().optional(),
  include_session_summary_on_delete: z.boolean().optional(),
})

export const MemoryConfigSchema = z.object({
  enabled: z.boolean().optional(),
  target_agents: z.array(z.string()).optional(),
  retrieval: MemoryRetrievalConfigSchema.optional(),
  capture: MemoryCaptureConfigSchema.optional(),
  lifecycle: MemoryLifecycleConfigSchema.optional(),
  budget: MemoryBudgetConfigSchema.optional(),
  taxonomy: MemoryTaxonomyConfigSchema.optional(),
  observation_ledger: MemoryObservationLedgerConfigSchema.optional(),
  reducer: MemoryReducerConfigSchema.optional(),
  observability: MemoryObservabilityConfigSchema.optional(),
})

export type MemoryScope = z.infer<typeof MemoryScopeSchema>
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>
export type MemoryRetrievalConfig = z.infer<typeof MemoryRetrievalConfigSchema>
export type MemoryCaptureConfig = z.infer<typeof MemoryCaptureConfigSchema>
export type MemoryLifecycleConfig = z.infer<typeof MemoryLifecycleConfigSchema>
export type MemoryBudgetConfig = z.infer<typeof MemoryBudgetConfigSchema>
export type MemoryTaxonomyConfig = z.infer<typeof MemoryTaxonomyConfigSchema>
export type MemoryObservationLedgerConfig = z.infer<typeof MemoryObservationLedgerConfigSchema>
export type MemoryReducerConfig = z.infer<typeof MemoryReducerConfigSchema>
export type MemoryObservabilityConfig = z.infer<typeof MemoryObservabilityConfigSchema>
