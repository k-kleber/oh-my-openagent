export const HOOK_NAME = "brainstormer-sisyphus-md-only"

export const ALLOWED_EXTENSIONS = [".md"]

export const BLOCKED_TOOLS = [
  "Write",
  "write",
  "Edit",
  "edit",
  "apply_patch",
  "ApplyPatch",
  "patch",
  "hashline_edit",
  "HashlineEdit",
]

export const ALLOWED_BRAINSTORM_FILE_PATTERNS = [
  /(?:^|[\\/])\.sisyphus[\\/]drafts[\\/]brainstorm(?:[-_][^\\/]+)?\.md$/i,
  /(?:^|[\\/])\.sisyphus[\\/]drafts[\\/]brainstorms[\\/]brainstorm(?:[-_][^\\/]+)?\.md$/i,
]

export const BRAINSTORMER_AGENT = "brainstormer"
