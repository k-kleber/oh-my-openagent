import { z } from "zod"

export const WebsearchProviderSchema = z.enum(["exa", "tavily"])

export const WebsearchConfigSchema = z.object({
  /**
   * Websearch provider to use.
   * - "exa": Uses Exa websearch
   * - "tavily": Uses Tavily websearch (requires TAVILY_API_KEY)
   *
   * If omitted, runtime auto-selects Tavily when a Tavily API key is available,
   * otherwise falls back to Exa.
   */
  provider: WebsearchProviderSchema.optional(),
})

export type WebsearchProvider = z.infer<typeof WebsearchProviderSchema>
export type WebsearchConfig = z.infer<typeof WebsearchConfigSchema>
