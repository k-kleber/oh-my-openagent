import { relative, resolve, isAbsolute } from "node:path"

import { ALLOWED_BRAINSTORM_FILE_PATTERNS, ALLOWED_EXTENSIONS } from "./constants"

export function isAllowedFile(filePath: string, workspaceRoot: string): boolean {
  const resolved = resolve(workspaceRoot, filePath)
  const rel = relative(workspaceRoot, resolved)

  if (rel.startsWith("..") || isAbsolute(rel)) {
    return false
  }

  const normalizedRelativePath = rel.replace(/\\/g, "/")

  if (!/\.sisyphus[/\\]/i.test(normalizedRelativePath)) {
    return false
  }

  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) =>
    resolved.toLowerCase().endsWith(ext.toLowerCase()),
  )

  if (!hasAllowedExtension) {
    return false
  }

  return ALLOWED_BRAINSTORM_FILE_PATTERNS.some((pattern) => pattern.test(normalizedRelativePath))
}
