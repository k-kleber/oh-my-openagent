import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import type { ClaudeCodeMcpServer } from "../claude-code-mcp-loader/types"
import { createCleanMcpEnvironment } from "./env-cleaner"
import { registerProcessCleanup, startCleanupTimer } from "./cleanup"
import type { ManagedClient, SkillMcpClientConnectionParams } from "./types"

function getStdioCommand(config: ClaudeCodeMcpServer, serverName: string): string {
  if (!config.command) {
    throw new Error(`MCP server "${serverName}" is configured for stdio but missing 'command' field.`)
  }
  return config.command
}

function normalizeStdioInvocation(config: ClaudeCodeMcpServer, serverName: string): { command: string; args: string[] } {
  const rawConfig = config as { command?: unknown; args?: unknown }
  const rawCommand = rawConfig.command
  const rawArgs = rawConfig.args

  const normalizedConfigArgs = Array.isArray(rawArgs) ? rawArgs.map((arg) => String(arg)) : []

  if (Array.isArray(rawCommand)) {
    if (rawCommand.length === 0) {
      throw new Error(`MCP server "${serverName}" has invalid 'command': empty array.`)
    }

    return {
      command: String(rawCommand[0]),
      args: [...rawCommand.slice(1).map((arg) => String(arg)), ...normalizedConfigArgs],
    }
  }

  const command = getStdioCommand(config, serverName)
  if (typeof command !== "string") {
    throw new Error(
      `MCP server "${serverName}" has invalid 'command' type. Expected string or string[], received ${typeof rawCommand}.`
    )
  }

  return {
    command,
    args: normalizedConfigArgs,
  }
}

export async function createStdioClient(params: SkillMcpClientConnectionParams): Promise<Client> {
  const { state, clientKey, info, config } = params
  const shutdownGenAtStart = state.shutdownGeneration

  const { command, args } = normalizeStdioInvocation(config, info.serverName)
  const mergedEnv = createCleanMcpEnvironment(config.env)

  registerProcessCleanup(state)

  const transport = new StdioClientTransport({
    command,
    args,
    env: mergedEnv,
    stderr: "ignore",
  })

  const client = new Client(
    { name: `skill-mcp-${info.skillName}-${info.serverName}`, version: "1.0.0" },
    { capabilities: {} }
  )

  try {
    await client.connect(transport)
  } catch (error) {
    // Close transport to prevent orphaned MCP process on connection failure
    try {
      await transport.close()
    } catch {
      // Process may already be terminated
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Failed to connect to MCP server "${info.serverName}".\n\n` +
      `Command: ${command} ${args.join(" ")}\n` +
      `Reason: ${errorMessage}\n\n` +
      `Hints:\n` +
      `  - Ensure the command is installed and available in PATH\n` +
      `  - Check if the MCP server package exists\n` +
      `  - Verify the args are correct for this server`
    )
  }

  if (state.shutdownGeneration !== shutdownGenAtStart) {
    try { await client.close() } catch {}
    try { await transport.close() } catch {}
    throw new Error(`MCP server "${info.serverName}" connection completed after shutdown`)
  }

  const managedClient = {
    client,
    transport,
    skillName: info.skillName,
    lastUsedAt: Date.now(),
    connectionType: "stdio",
  } satisfies ManagedClient

  state.clients.set(clientKey, managedClient)
  startCleanupTimer(state)
  return client
}
