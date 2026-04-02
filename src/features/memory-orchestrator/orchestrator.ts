import { memoryMcpSkill } from "../builtin-skills/skills/memory-mcp"
import type { SkillMcpManager, SkillMcpClientInfo, SkillMcpServerContext } from "../skill-mcp-manager"
import { runRg } from "../../tools/grep/cli"
import { runRgFiles } from "../../tools/glob/cli"
import { withLspClient } from "../../tools/lsp/lsp-client-wrapper"
import type {
  MemoryObservationCandidate,
  MemoryRecallInput,
  MemoryRecallItem,
  MemoryRecallResult,
  MemoryStoreInput,
  MemoryStoreResult,
} from "./types"
import { resolveMemoryProjectIdentity } from "./project-identity"

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function pickString(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string") {
      const normalized = compactText(value)
      if (normalized.length > 0) return normalized
    }
  }
  return null
}

function maybeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function inferVerificationFromContent(content: string): MemoryRecallItem["verification"] {
  const normalized = content.toLowerCase()
  if (normalized.includes("contradicted")) return "contradicted"
  if (normalized.includes("no contextual memories matched the query")) return "stale"
  return "likely-valid"
}

function extractEvidenceTokens(content: string): string[] {
  const matches = content.match(/[A-Za-z0-9_./-]{4,}/g) ?? []
  return [...new Set(matches)].slice(0, 5)
}

function extractLikelySymbol(content: string): string | null {
  const symbolMatch = content.match(/\b([A-Z][A-Za-z0-9_]{2,}|[a-z][A-Za-z0-9_]{2,})\b/)
  return symbolMatch?.[1] ?? null
}

function buildClientInfo(sessionID: string, serverName: "hindsight" | "openmemory"): SkillMcpClientInfo {
  return {
    sessionID,
    serverName,
    skillName: memoryMcpSkill.name,
  }
}

function buildServerContext(serverName: "hindsight" | "openmemory"): SkillMcpServerContext {
  const config = memoryMcpSkill.mcpConfig?.[serverName]
  if (!config) {
    throw new Error(`Missing MCP config for ${serverName}`)
  }
  return {
    skillName: memoryMcpSkill.name,
    config,
  }
}

function normalizeObservation(observation: string, input: MemoryStoreInput): MemoryObservationCandidate {
  const normalized = observation.replace(/\s+/g, " ").trim().slice(0, 100)
  const evidenceCount = Math.max(1, input.observations.filter((item) => item.includes(observation.split("->")[0] ?? "")).length)
  const confidence = Math.min(1, 0.55 + evidenceCount * 0.15)
  return {
    insight: normalized,
    confidence,
    evidenceCount,
    dedupeKey: normalized.toLowerCase(),
    promote: confidence >= input.promotionThreshold && evidenceCount >= input.crossProjectEvidenceMin,
    scope: input.scope,
  }
}

export class MemoryOrchestrator {
  constructor(private readonly manager: SkillMcpManager) {}

  async recall(input: MemoryRecallInput): Promise<MemoryRecallResult> {
    const hindsightInfo = buildClientInfo(input.sessionID, "hindsight")
    const hindsightContext = buildServerContext("hindsight")
    const openmemoryInfo = buildClientInfo(input.sessionID, "openmemory")
    const openmemoryContext = buildServerContext("openmemory")

    const projectIdentity = resolveMemoryProjectIdentity(input.projectPath, input.projectName)

    const enrichedQuery = [input.query, input.agentName, ...(input.recentTools ?? [])]
      .filter(Boolean)
      .join(" ")
      .trim()

    const hindsight = await this.manager.callTool(hindsightInfo, hindsightContext, "recall", {
      query: enrichedQuery,
      bank_id: "default",
    })

    const openmemory = await this.manager.callTool(openmemoryInfo, openmemoryContext, "openmemory_query", {
      query: enrichedQuery,
      type: "contextual",
      k: 8,
      user_id: projectIdentity.projectKey,
    })

    const rawItems = [
      ...this.normalizeRecallResponse(hindsight, "hindsight", input.scope),
      ...this.normalizeRecallResponse(openmemory, "openmemory", input.scope),
    ]
    const verifiedItems = await Promise.all(rawItems.map((item) => this.verifyRecallItem(item, input.projectPath)))
    const items = verifiedItems
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)

    return {
      items,
      hits: items.length,
    }
  }

  async store(input: MemoryStoreInput): Promise<MemoryStoreResult> {
    const hindsightInfo = buildClientInfo(input.sessionID, "hindsight")
    const hindsightContext = buildServerContext("hindsight")
    const openmemoryInfo = buildClientInfo(input.sessionID, "openmemory")
    const openmemoryContext = buildServerContext("openmemory")

    const projectIdentity = resolveMemoryProjectIdentity(input.projectPath, input.projectName)

    const candidates = input.observations
      .map((observation) => normalizeObservation(observation, input))
      .filter((candidate) => candidate.confidence >= input.confidenceThreshold)

    const stored: MemoryObservationCandidate[] = []
    const deduped: MemoryObservationCandidate[] = []
    const contradicted: MemoryObservationCandidate[] = []
    const promoted: MemoryObservationCandidate[] = []

    for (const candidate of candidates) {
      const existing = await this.manager.callTool(openmemoryInfo, openmemoryContext, "openmemory_query", {
        query: candidate.insight,
        type: "contextual",
        k: 5,
        user_id: projectIdentity.projectKey,
      })

      const existingText = JSON.stringify(existing).toLowerCase()
      if (existingText.includes(candidate.dedupeKey)) {
        deduped.push(candidate)
        continue
      }

      if (existingText.includes("contradicted")) {
        contradicted.push(candidate)
        continue
      }

      await this.manager.callTool(hindsightInfo, hindsightContext, "retain", {
        content: `[workflow] ${candidate.insight}`,
        context: input.projectPath,
        tags: [projectIdentity.projectKey, `repo:${projectIdentity.projectLabel}`, candidate.scope],
        bank_id: "default",
      })

      await this.manager.callTool(openmemoryInfo, openmemoryContext, "openmemory_store", {
        content: `[approved] [${candidate.scope}] ${candidate.insight}`,
        user_id: projectIdentity.projectKey,
        tags: [projectIdentity.projectKey, `repo:${projectIdentity.projectLabel}`, `scope:${candidate.scope}`],
        metadata: {
          type: "workflow",
          scope: candidate.scope,
          approvalState: "approved",
          reason: input.reason,
          dedupeKey: candidate.dedupeKey,
          evidenceCount: candidate.evidenceCount,
          projectKey: projectIdentity.projectKey,
          projectLabel: projectIdentity.projectLabel,
        },
      })

      stored.push(candidate)
      if (candidate.promote) {
        promoted.push(candidate)
      }
    }

    return { stored, deduped, contradicted, promoted }
  }

  private normalizeRecallResponse(
    result: unknown,
    source: "hindsight" | "openmemory",
    scope: MemoryStoreInput["scope"],
  ): MemoryRecallItem[] {
    const items: MemoryRecallItem[] = []

    const pushItem = (content: string, index: number, scoreOverride?: number) => {
      const normalized = compactText(content)
      if (normalized.length < 8) return
      items.push({
        content: normalized,
        source,
        scope,
        score: Math.max(0.1, scoreOverride ?? (1 - index * 0.1)),
        verification: inferVerificationFromContent(normalized),
      })
    }

    if (!isRecord(result)) {
      const serialized = typeof result === "string" ? result : JSON.stringify(result)
      const normalized = compactText(serialized)
      if (normalized.length > 0 && normalized !== "[]" && normalized !== "{}") {
        pushItem(normalized, 0)
      }
      return items.slice(0, 5)
    }

    if (source === "hindsight") {
      const hindsightResults = toArray(result.results)
      hindsightResults.forEach((entry, index) => {
        if (!isRecord(entry)) return
        const text = pickString(entry, ["text", "content", "insight"])
        if (!text) return
        const mentionedAt = pickString(entry, ["mentioned_at", "timestamp"])
        const involving = pickString(entry, ["involving"])
        const enriched = [text, mentionedAt ? `When: ${mentionedAt}` : null, involving ? `Involving: ${involving}` : null]
          .filter((part): part is string => Boolean(part))
          .join(" | ")
        pushItem(enriched, index)
      })

      const hindsightText = pickString(result, ["text", "message", "content"])
      if (items.length === 0 && hindsightText) {
        pushItem(hindsightText, 0)
      }

      return items.slice(0, 5)
    }

    const openmemoryResults = toArray(result.results)
    openmemoryResults.forEach((entry, index) => {
      if (!isRecord(entry)) return
      const text = pickString(entry, ["content", "text", "summary"])
      if (!text) return
      const score = maybeNumber(entry.score)
      pushItem(text, index, score ?? undefined)
    })

    if (items.length === 0) {
      const message = pickString(result, ["message", "error", "text"])
      if (message) pushItem(message, 0)
    }

    return items.slice(0, 5)
  }

  private async verifyRecallItem(item: MemoryRecallItem, projectPath: string): Promise<MemoryRecallItem> {
    const tokens = extractEvidenceTokens(item.content)
    if (tokens.length === 0) {
      return { ...item, verification: "unverifiable" }
    }

    const likelySymbol = extractLikelySymbol(item.content)
    if (likelySymbol) {
      const semantic = await this.verifySymbol(projectPath, likelySymbol)
      if (semantic) {
        return {
          ...item,
          verification: semantic.verification,
          evidence: semantic.evidence,
          score: item.score + (semantic.verification === "verified" ? 0.2 : 0.05),
        }
      }
    }

    for (const token of tokens) {
      const fileMatches = await runRgFiles({
        pattern: `*${token.split("/").pop() ?? token}*`,
        paths: [projectPath],
        limit: 5,
      })

      if (fileMatches.files.length > 0) {
        const contentMatches = await runRg({
          pattern: token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          paths: [projectPath],
          fixedStrings: true,
          outputMode: "content",
          headLimit: 1,
        })

        const firstMatch = contentMatches.matches[0]
        if (firstMatch) {
          return {
            ...item,
            verification: item.content.toLowerCase().includes("deprecated") ? "contradicted" : "verified",
            evidence: {
              path: firstMatch.file,
              line: firstMatch.line,
              snippet: firstMatch.text,
            },
          }
        }

        return {
          ...item,
          verification: "partially_verified",
          evidence: {
            path: fileMatches.files[0]?.path,
          },
        }
      }
    }

    return {
      ...item,
      verification: "stale",
    }
  }

  private async verifySymbol(
    projectPath: string,
    symbol: string,
  ): Promise<Pick<MemoryRecallItem, "verification" | "evidence"> | null> {
    const fileCandidates = await runRgFiles({
      pattern: `*.{ts,tsx,js,jsx,py,go,rs}`,
      paths: [projectPath],
      limit: 20,
    })

    for (const file of fileCandidates.files) {
      try {
        const symbols = await withLspClient(file.path, async (client) => {
          return await client.documentSymbols(file.path)
        })

        const serialized = JSON.stringify(symbols)
        if (serialized.includes(symbol)) {
          return {
            verification: "verified",
            evidence: { path: file.path, snippet: symbol },
          }
        }
      } catch {
      }
    }

    return null
  }
}
