import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { getOpenCodeConfigDir } from "./opencode-config-dir"

function parseKeyFromEnvFile(filePath: string, keyName: string): string | undefined {
  if (!existsSync(filePath)) return undefined

  const content = readFileSync(filePath, "utf-8")
  const lines = content.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const match = trimmed.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      ?? trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)

    if (!match) continue

    const [, name, rawValue] = match
    if (name !== keyName) continue

    const value = rawValue.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1")
    return value || undefined
  }

  return undefined
}

export function getEnvOrSecretsValue(keyName: string): string | undefined {
  const direct = process.env[keyName]?.trim()
  if (direct) return direct

  const cwd = process.cwd()
  const opencodeDir = getOpenCodeConfigDir({ binary: "opencode" })
  const candidates = [
    join(cwd, ".secrets"),
    join(cwd, ".env"),
    join(opencodeDir, ".secrets"),
    join(opencodeDir, ".env"),
    join(homedir(), ".secrets"),
    join(homedir(), ".env"),
  ]

  for (const filePath of candidates) {
    const found = parseKeyFromEnvFile(filePath, keyName)?.trim()
    if (found) return found
  }

  return undefined
}
