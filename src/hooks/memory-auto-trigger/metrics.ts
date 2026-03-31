export interface MemoryMetricsState {
  observationsCaptured: number
  retrievalHits: number
  reducerEligibleEvents: number
  reducerCandidatesSuggested: number
  autoCapturesTriggered: number
  lifecycleCapturesTriggered: number
  promotionCandidatesSuggested: number
  promotionThresholdHits: number
  memoryTaskResets: number
}

export function createMemoryMetricsState(): MemoryMetricsState {
  return {
    observationsCaptured: 0,
    retrievalHits: 0,
    reducerEligibleEvents: 0,
    reducerCandidatesSuggested: 0,
    autoCapturesTriggered: 0,
    lifecycleCapturesTriggered: 0,
    promotionCandidatesSuggested: 0,
    promotionThresholdHits: 0,
    memoryTaskResets: 0,
  }
}
