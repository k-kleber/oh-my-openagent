import type { BuiltinSkill } from "../types"

export const memoryObservationLedgerSkill: BuiltinSkill = {
  name: "memory-observation-ledger",
  description: "Observation ledger guidance for hybrid memory ingestion. Use for project-scoped evidence capture before reduction.",
  template: `# Memory Observation Ledger

Use this guidance when the runtime hook captures repeated, project-scoped observations before memory storage.

## Purpose

- collect raw evidence without storing it directly as durable memory
- keep observations project-scoped first
- feed a reducer before memory-store runs

## Observation quality bar

Capture only if the event is:
- non-trivial
- related to repeated exploration, debugging, or workflow behavior
- useful as evidence for a future memory candidate

## Do not treat ledger entries as memories

- ledger entries are evidence only
- reducer output decides whether something becomes a memory candidate
- memory-store remains the only persistence path for long-term memory`,
}
