import { z } from "zod"

import { GitEnvPrefixSchema } from "./git-env-prefix"

export const GitMasterConfigSchema = z.object({
	/** Add an optional commit footer (default: false). Can be boolean or custom string. */
	commit_footer: z.union([z.boolean(), z.string()]).default(false),
	/** Add an optional Co-authored-by trailer (default: false). */
	include_co_authored_by: z.boolean().default(false),
	/** Environment variable prefix for all git commands (default: "GIT_MASTER=1"). Set to "" to disable. Allows custom git hooks to detect git-master skill usage. */
	git_env_prefix: GitEnvPrefixSchema,
})

export type GitMasterConfig = z.infer<typeof GitMasterConfigSchema>
