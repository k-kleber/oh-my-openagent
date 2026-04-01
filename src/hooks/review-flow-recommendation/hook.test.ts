import { describe, expect, test, beforeEach, afterEach, spyOn } from "bun:test";
import { createReviewFlowRecommendationHook } from "./hook";
import * as sharedModule from "../../shared";

describe("review-flow-recommendation hook", () => {
  let logSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(sharedModule, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy?.mockRestore();
  });

  function createMockPluginInput() {
    return {} as any;
  }

  test("should recommend security specialist for security-sensitive keywords", async () => {
    const hook = createReviewFlowRecommendationHook(createMockPluginInput());
    const sessionID = "test-session";
    const input = { tool: "read", sessionID, callID: "1" };
    const output = {
      title: "Reading file",
      output: "file content",
      metadata: { prompt: "I need to fix the auth logic and check the password hashing" },
    };

    await hook["tool.execute.after"](input, output);

    expect(output.output).toContain("security");
    expect(output.output).toContain("task(category='security', ...)");
  });

  test("should recommend performance specialist for performance-sensitive keywords", async () => {
    const hook = createReviewFlowRecommendationHook(createMockPluginInput());
    const sessionID = "test-session";
    const input = { tool: "read", sessionID, callID: "1" };
    const output = {
      title: "Reading file",
      output: "file content",
      metadata: { prompt: "This logic is very slow, let's optimize it" },
    };

    await hook["tool.execute.after"](input, output);

    expect(output.output).toContain("performance");
    expect(output.output).toContain("task(category='performance', ...)");
  });

  test("should recommend frontend specialist for UI-related file changes", async () => {
    const hook = createReviewFlowRecommendationHook(createMockPluginInput());
    const sessionID = "test-session";
    const input = { tool: "edit", sessionID, callID: "1" };
    const output = {
      title: "Editing file",
      output: "file content",
      metadata: {
        prompt: "Update the button styles",
        changedFiles: ["src/components/Button.tsx"],
      },
    };

    await hook["tool.execute.after"](input, output);

    expect(output.output).toContain("visual-engineering");
    expect(output.output).toContain("task(category='visual-engineering', ...)");
  });

  test("should combine multiple recommendations", async () => {
    const hook = createReviewFlowRecommendationHook(createMockPluginInput());
    const sessionID = "test-session";
    const input = { tool: "edit", sessionID, callID: "1" };
    const output = {
      title: "Editing file",
      output: "file content",
      metadata: {
        prompt: "Optimize the auth component performance",
        changedFiles: ["src/components/Auth.tsx"],
      },
    };

    await hook["tool.execute.after"](input, output);

    expect(output.output).toContain("security");
    expect(output.output).toContain("performance");
    expect(output.output).toContain("visual-engineering");
  });

  test("should NOT recommend if no rules match", async () => {
    const hook = createReviewFlowRecommendationHook(createMockPluginInput());
    const sessionID = "test-session";
    const input = { tool: "read", sessionID, callID: "1" };
    const output = {
      title: "Reading file",
      output: "file content",
      metadata: { prompt: "Just reading a random file" },
    };

    await hook["tool.execute.after"](input, output);

    expect(output.output).not.toContain("💡 **Recommendation**");
  });
});
