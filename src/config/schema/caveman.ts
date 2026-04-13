import { z } from "zod"

export const CavemanConfigSchema = z.object({
  /** Enable Caveman feature (default: false) */
  enabled: z.boolean().optional(),
})

export type CavemanConfig = z.infer<typeof CavemanConfigSchema>
