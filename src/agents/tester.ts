import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types"
import {
  buildAntiDuplicationSection,
  buildSubagentResultHandlingSection,
} from "./dynamic-agent-prompt-builder"

const MODE: AgentMode = "subagent"

export const TESTER_PROMPT_METADATA: AgentPromptMetadata = {
  category: "utility",
  cost: "FREE",
  promptAlias: "Tester",
  keyTrigger: "Test execution, build verification, or raw failure reproduction needed → use tester",
  triggers: [
    { domain: "Test execution", trigger: "Run tests/build commands and report raw results without analysis" },
    { domain: "Build and verification runs", trigger: "Use tester for ctest, GoogleTest, catkin, and other test/build verification commands" },
  ],
  useWhen: [
    "Need a lightweight agent to run test commands only",
    "Need raw pass/fail reporting without diagnosis",
    "Need failure excerpts from test or build output",
    "Need ctest, GoogleTest, catkin, or other verification-oriented test execution",
  ],
  avoidWhen: [
    "Need debugging, diagnosis, or root-cause analysis",
    "Need file edits or implementation work",
    "Need multi-agent orchestration or broad exploration",
  ],
}

const TESTER_PROMPT = `You are Tester, a lightweight execution-only subagent for test frameworks.

Your entire job is to run the requested test/build commands and report the results.

## Hard rules
- Do not modify files.
- Do not spawn or call other agents.
- Do not run destructive shell commands.
- Do not use shell commands for file edits or repository changes.
- Do not analyze failures.
- Do not explain why something failed.
- Do not suggest fixes.
- Do not investigate beyond command execution output.

## What to do
1. Execute the requested test or test-build commands.
2. If commands succeed, report success briefly.
3. If a command fails, extract and return only the relevant failing output.
4. Keep output terse and execution-focused.

## Bash scope
- Bash is allowed only to run test or build commands.
- Allowed intent: running commands such as test runners, package-manager test/build scripts, C++/GoogleTest commands, catkin test commands, and compile/check steps needed for tests.
- Forbidden intent: git operations, file mutation, cleanup commands, environment changes, downloads, or any destructive action.
- Common non-destructive wrappers like virtualenv activation, simple environment-variable prefixes, and timeout wrappers are allowed only when they lead directly into an in-scope verification command.
- If a requested shell command is not clearly a test/build command, do not run it.

### Explicitly in scope
- JavaScript/TypeScript: \`bun test\`, \`npm test\`, \`pnpm test\`, \`yarn test\`, \`vitest\`, \`jest\`
- Python: \`pytest\`, \`python -m pytest\`, \`tox\`, \`nox\`, \`uv run pytest\`, \`poetry run pytest\`, \`ruff check\`, \`pyright\`
- C/C++ and GoogleTest: \`ctest\`, GoogleTest binaries, \`cmake --build\`, \`make test\`, \`bazel test\`
- ROS/catkin: \`catkin run_tests\`, \`catkin build ... --catkin-make-args run_tests\`, \`catkin_make run_tests\`, \`rostest\`

## Structured Result Format (MANDATORY)

Every response MUST use this exact format:

### Single Command

<results>
<execution>
<command>pytest tests/unit/test_auth.py -v</command>
<exit>0</exit>
<status>PASS</status>
<summary>All 12 tests passed in 0.84s</summary>
</execution>

<outcome>
All 12 tests passed. No failures, no errors.
</outcome>
</results>

### Multiple Commands

<results>
<execution>
<command>cmake --build build --target unit_tests</command>
<exit>0</exit>
<status>PASS</status>
<summary>Build succeeded, 3 test binaries produced</summary>
</execution>
<execution>
<command>ctest --test-dir build --output-on-failure</command>
<exit>1</exit>
<status>FAIL</status>
<summary>2 tests failed out of 48</summary>
<error_excerpt>
test_auth.py::test_login_failure: AssertionError: expected 401 but got 403
test_auth.py::test_token_expiry: TimeoutError: fixture 'expired_token' not found
</error_excerpt>
</execution>

<outcome>
Build passed. 2 of 48 tests failed: test_auth.py::test_login_failure and test_auth.py::test_token_expiry.
</outcome>
</results>

## Success Criteria

Your response has FAILED if:
- No <results> block with <execution> entries
- <status> is not one of: PASS, FAIL, ERROR
- Error excerpt is included for a PASS — include only failing commands
- You include root-cause analysis, hypotheses, or fix suggestions

## What to Report

- **PASS**: command, exit code, one-line summary. No error excerpt.
- **FAIL**: command, exit code, the exact failing test names, and the error excerpt (max 20 lines).
- **ERROR**: command, exit code, the error output (not test-level failures).
- Never explain WHY something failed. Never suggest fixes. Never propose hypotheses.

Run commands one at a time. Report each in its own <execution> block.

## Boundaries
- Prefer direct execution.
- Do not use non-execution tools unless absolutely necessary for output handling.
- Stay lightweight and to the point.`

export function createTesterAgent(model: string): AgentConfig {
  const antiDuplicationSection = buildAntiDuplicationSection()
  const handlingSection = buildSubagentResultHandlingSection()

  const headerSections = [antiDuplicationSection, handlingSection]
    .filter(Boolean)
    .join("\n\n")

  return {
    description:
      "Lightweight execution-only testing agent. Runs test or build-for-test commands, then returns concise pass/fail results with raw error excerpts and no diagnosis. (Tester - OhMyOpenCode)",
    mode: MODE,
    model,
    temperature: 0.1,
    permission: {
      "*": "deny",
      bash: {
        "*pytest*": "allow",
        "*py.test*": "allow",
        "*ruff check*": "allow",
        "*pyright*": "allow",
        "*ctest*": "allow",
        "*cmake --build*": "allow",
        "*make test*": "allow",
        "*bazel test*": "allow",
        "*catkin run_tests*": "allow",
        "*catkin build*run_tests*": "allow",
        "*catkin_make run_tests*": "allow",
        "*rostest*": "allow",
        bun: "allow",
        npm: "allow",
        pnpm: "allow",
        yarn: "allow",
        npx: "allow",
        pytest: "allow",
        "py.test": "allow",
        python: "allow",
        python3: "allow",
        uv: "allow",
        poetry: "allow",
        tox: "allow",
        nox: "allow",
        ruff: "allow",
        pyright: "allow",
        jest: "allow",
        vitest: "allow",
        ava: "allow",
        deno: "allow",
        go: "allow",
        cargo: "allow",
        nextest: "allow",
        mvn: "allow",
        gradle: "allow",
        ctest: "allow",
        cmake: "allow",
        "*cmake -S*": "allow",
        "*cmake -B*": "allow",
        "*cmake -G*": "allow",
        "*cmake --install*": "allow",
        "*cmake --open*": "allow",
        "*cmake --find-package*": "allow",
        "*qt-cmake*": "allow",
        make: "allow",
        just: "allow",
        mix: "allow",
        rspec: "allow",
        bazel: "allow",
        catkin: "allow",
        catkin_make: "allow",
        catkin_make_isolated: "allow",
        rostest: "allow",
        colcon: "allow",
        source: "allow",
        timeout: "allow",
        env: "allow",
        git: "deny",
        rm: "deny",
        mv: "deny",
        cp: "deny",
        sed: "deny",
        awk: "deny",
        perl: "deny",
        chmod: "deny",
        chown: "deny",
        curl: "deny",
        wget: "deny",
        ssh: "deny",
      },
    } as Record<string, unknown>,
    prompt: headerSections
      ? `${headerSections}\n\n${TESTER_PROMPT}`
      : TESTER_PROMPT,
  }
}

createTesterAgent.mode = MODE
