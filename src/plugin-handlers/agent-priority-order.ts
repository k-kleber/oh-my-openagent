import { getAgentDisplayName } from "../shared/agent-display-names";

const CORE_AGENT_ORDER: ReadonlyArray<{ displayName: string; order: number }> = [
  { displayName: getAgentDisplayName("sisyphus"), order: 1 },
  { displayName: getAgentDisplayName("brainstormer"), order: 2 },
  { displayName: getAgentDisplayName("researcher"), order: 3 },
  { displayName: getAgentDisplayName("writer"), order: 4 },
  { displayName: getAgentDisplayName("debugger"), order: 5 },
  { displayName: getAgentDisplayName("hephaestus"), order: 6 },
  { displayName: getAgentDisplayName("prometheus"), order: 7 },
  { displayName: getAgentDisplayName("atlas"), order: 8 },
];

function injectOrderField(
  agentConfig: unknown,
  order: number,
): unknown {
  if (typeof agentConfig === "object" && agentConfig !== null) {
    return { ...agentConfig, order };
  }
  return agentConfig;
}

export function reorderAgentsByPriority(
  agents: Record<string, unknown>,
): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  const seen = new Set<string>();

  for (const { displayName, order } of CORE_AGENT_ORDER) {
    if (Object.prototype.hasOwnProperty.call(agents, displayName)) {
      ordered[displayName] = injectOrderField(agents[displayName], order);
      seen.add(displayName);
    }
  }

  for (const [key, value] of Object.entries(agents)) {
    if (!seen.has(key)) {
      ordered[key] = value;
    }
  }

  return ordered;
}
