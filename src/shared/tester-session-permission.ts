import type { SessionPermissionRule } from "./question-denied-session-permission"

export const TESTER_SESSION_PERMISSION: SessionPermissionRule[] = [
  { permission: "question", action: "deny", pattern: "*" },
]
