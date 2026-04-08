const openmemoryApiKey = process.env.OPENMEMORY_API_KEY?.trim() || "local-dev-key"

export const openmemory = {
  type: "remote" as const,
  url: "http://localhost:8080/mcp",
  enabled: true,
  headers: { "x-api-key": openmemoryApiKey },
  oauth: false as const,
}
