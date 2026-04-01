import type { PluginInput } from "@opencode-ai/plugin";
import { REVIEW_FLOW_RULES, type TriggerRule } from "./rules";
import { log } from "../../shared";

interface ToolExecuteInput {
  tool: string;
  sessionID: string;
  callID: string;
}

interface ToolExecuteOutput {
  title: string;
  output: string;
  metadata: Record<string, unknown>;
}

export function createReviewFlowRecommendationHook(_ctx: PluginInput) {
  const toolExecuteAfter = async (
    input: ToolExecuteInput,
    output: ToolExecuteOutput,
  ) => {
    const { tool } = input;
    const { output: toolOutput } = output;

    const prompt = (output.metadata?.prompt as string) || "";
    const changedFiles = (output.metadata?.changedFiles as string[]) || [];

    const recommendations: string[] = [];

    for (const rule of REVIEW_FLOW_RULES) {
      if (matchesRule(rule, tool, prompt, changedFiles)) {
        recommendations.push(rule.recommendation);
      }
    }

    if (recommendations.length > 0) {
      const uniqueRecommendations = Array.from(new Set(recommendations));
      output.output += `\n\n---\n${uniqueRecommendations.join("\n\n")}\n`;
      log("[review-flow-recommendation] Added recommendations", {
        count: uniqueRecommendations.length,
        rules: REVIEW_FLOW_RULES.filter(r => recommendations.includes(r.recommendation)).map(r => r.id),
      });
    }
  };

  function matchesRule(
    rule: TriggerRule,
    tool: string,
    prompt: string,
    changedFiles: string[],
  ): boolean {
    const { condition } = rule;

    if (condition.tools && condition.tools.includes(tool.toLowerCase())) {
      return true;
    }

    if (condition.intentKeywords) {
      const lowerPrompt = prompt.toLowerCase();
      if (condition.intentKeywords.some(kw => lowerPrompt.includes(kw.toLowerCase()))) {
        return true;
      }
    }

    if (condition.changedFiles && changedFiles.length > 0) {
      for (const pattern of condition.changedFiles) {
        const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        const regex = new RegExp(escapedPattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"))
        if (changedFiles.some(file => regex.test(file))) {
          return true
        }
      }
    }

    return false;
  }

  return {
    "tool.execute.after": toolExecuteAfter,
  };
}
