export interface TriggerRule {
  id: string;
  name: string;
  description: string;
  recommendation: string;
  condition: {
    tools?: string[];
    changedFiles?: string[];
    intentKeywords?: string[];
    languages?: string[];
  };
}

export const REVIEW_FLOW_RULES: TriggerRule[] = [
  {
    id: "security-review",
    name: "Security Specialist",
    description: "Matches security-sensitive changes",
    recommendation: "💡 **Recommendation**: Consider a security review for these changes.\n   Run: `task(category='security', ...)`",
    condition: {
      intentKeywords: ["auth", "password", "token", "encrypt", "secret", "permission", "access"],
      changedFiles: ["**/auth/**", "**/security/**", "**/permission/**", ".env*"],
    },
  },
  {
    id: "performance-review",
    name: "Performance Specialist",
    description: "Matches performance-critical changes",
    recommendation: "💡 **Recommendation**: These changes might impact performance. Consider a performance audit.\n   Run: `task(category='performance', ...)`",
    condition: {
      intentKeywords: ["slow", "optimize", "performance", "bottleneck", "cache", "latency", "throughput"],
      tools: ["benchmark", "profile"],
    },
  },
  {
    id: "frontend-review",
    name: "Frontend/UI Specialist",
    description: "Matches UI/UX changes",
    recommendation: "💡 **Recommendation**: You've modified UI components. A frontend specialist can help verify visual consistency.\n   Run: `task(category='visual-engineering', ...)`",
    condition: {
      changedFiles: ["**/*.tsx", "**/*.css", "**/*.scss", "**/components/**"],
      intentKeywords: ["ui", "ux", "style", "component", "button", "layout", "color"],
    },
  },
  {
    id: "test-specialist",
    name: "Test Specialist",
    description: "Matches large changes without tests",
    recommendation: "💡 **Recommendation**: This is a significant change. Consider delegating test generation to a specialist.\n   Run: `task(category='testing', ...)`",
    condition: {
      intentKeywords: ["refactor", "implement", "logic", "fix"],
      changedFiles: ["src/**/*.ts", "src/**/*.js"],
    },
  },
];
