import { execFileSync } from "node:child_process"
import { realpathSync } from "node:fs"
import { basename, dirname, resolve } from "node:path"

export interface MemoryProjectIdentity {
  projectKey: string
  projectLabel: string
}

function parseGitHubRemote(remoteUrl: string): { owner: string; repo: string } | null {
  const sshMatch = remoteUrl.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (sshMatch?.[1] && sshMatch[2]) {
    return { owner: sshMatch[1], repo: sshMatch[2] }
  }

  const httpsMatch = remoteUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (httpsMatch?.[1] && httpsMatch[2]) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] }
  }

  return null
}

function readRemoteUrl(directory: string, remote: string): string | null {
  try {
    return execFileSync("git", ["remote", "get-url", remote], {
      cwd: directory,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim()
  } catch {
    return null
  }
}

function listRemotes(directory: string): string[] {
  try {
    const output = execFileSync("git", ["remote"], {
      cwd: directory,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    })
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function resolveGitHubRepo(directory: string): { owner: string; repo: string } | null {
  const remotePreference = ["origin", ...listRemotes(directory)]
  const seen = new Set<string>()

  for (const remote of remotePreference) {
    if (seen.has(remote)) continue
    seen.add(remote)
    const remoteUrl = readRemoteUrl(directory, remote)
    if (!remoteUrl) continue

    const parsed = parseGitHubRemote(remoteUrl)
    if (parsed) return parsed
  }

  return null
}

function readGitCommonDir(directory: string): string | null {
  try {
    const output = execFileSync("git", ["rev-parse", "--git-common-dir"], {
      cwd: directory,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim()
    if (!output) return null
    const absolute = output.startsWith("/") ? output : resolve(directory, output)
    const resolved = realpathSync(absolute)
    return resolved.replace(/\\/g, "/")
  } catch {
    return null
  }
}

function resolveLocalGitIdentity(directory: string): { key: string; label: string } | null {
  const commonDir = readGitCommonDir(directory)
  if (!commonDir) return null

  const trimmed = commonDir.replace(/\/+$/, "")
  if (!trimmed) return null

  const labelSource = basename(trimmed).toLowerCase() === ".git" ? dirname(trimmed) : trimmed
  const label = basename(labelSource)
  if (!label) return null

  return {
    key: `git:${trimmed}`,
    label,
  }
}

export function resolveMemoryProjectIdentity(projectPath: string, fallbackProjectName: string): MemoryProjectIdentity {
  const githubRepo = resolveGitHubRepo(projectPath)
  if (githubRepo) {
    const canonical = `${githubRepo.owner}/${githubRepo.repo}`
    return {
      projectKey: `github:${canonical}`,
      projectLabel: canonical,
    }
  }

  const localIdentity = resolveLocalGitIdentity(projectPath)
  if (localIdentity) {
    return {
      projectKey: localIdentity.key,
      projectLabel: localIdentity.label,
    }
  }

  return {
    projectKey: fallbackProjectName,
    projectLabel: fallbackProjectName,
  }
}
