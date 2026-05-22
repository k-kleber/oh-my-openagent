# Upstream Upgrade Reference: v3.15.3 to v3.17.x

This document tracks which upstream changes from `code-yeongyu/oh-my-openagent` should be adopted into this fork, which ones need manual ports, and which ones are too risky to merge directly.

The local fork has meaningful divergence in these areas:

- plugin bootstrap and hook composition
- delegate-task and background-agent behavior
- Graphify integration
- metadata recovery and task/session linkage
- continuation, compaction, and Boulder session orchestration

Because of that, the right strategy is selective upgrade, not wholesale merge.

## Release window covered

Upstream releases after `v3.15.3`:

- `v3.16.0`
- `v3.17.0`
- `v3.17.2`
- `v3.17.3`
- `v3.17.4`

## Recommended adoption summary

### Direct cherry-picks

These are the safest, highest-value changes.

| Commit | Status | Notes |
|---|---|---|
| `e52dd340` | cherry-pick | OpenCode v1.4.0 chat params compatibility, moves from `options.maxTokens` to `maxOutputTokens` |
| `ae3a8d62` | cherry-pick | fixes silent subagent depth bypass in sync delegation |
| `0bf5dc26` | cherry-pick | token-limit detection normalization across providers |
| `b7d9521a` | cherry-pick | installer/postinstall minimum OpenCode version guard |
| `b77c2569` or `daae6ed0` | cherry-pick | BOM-safe JSONC parsing |

### Manual ports recommended

These are worth taking, but the local fork has enough custom code that direct cherry-picks are likely to be noisy or misleading.

| Commit | Status | Notes |
|---|---|---|
| `80d3339c` | manual port | include `wait-for-task-session`, wire it into local background output flow |
| `4da30057` | manual port | metadata recovery hardening, especially flexible call-id and task/session link extraction |
| `a1842f2d` | partial manual port | port only the metadata helpers needed by local recovery flows |
| `f4eabf9f` | manual port | deliberate `@opencode-ai/{plugin,sdk}` bump to 1.4.0 and regenerate artifacts locally |
| `76239972` | manual port | doctor should include custom providers from `opencode.json(c)` |
| `77514029` | manual port | quota exhaustion should stop retries in this fork's runtime fallback logic |
| `c5c5bc36` | manual port | consume fallback chain on `sendSyncPrompt` failure |
| `aed8dbfa` | manual port | final fetch before treating sync task as aborted |
| `3d2eb6e4` | manual port | preserve explicit `git_master` overrides during config merge |
| `7bc170fb` | manual port | Anthropic OAuth compatibility, hyphenated model IDs, and `variant=max` clamping |

### Optional

| Commit | Status | Notes |
|---|---|---|
| `73d407fe` | optional manual port | trusted skill MCP env expansion, changes security policy |
| `01f7d5e2` | optional | installer utility export cleanup |
| `7022a7e8` | optional | installer version compatibility helper |
| `2f86a175` | optional | installer backup utility |
| `a09b905b` | optional | small installer typed-support fix |

### Skip for now

| Commit | Status | Notes |
|---|---|---|
| `78e6d780` | skip as full cherry-pick | too much hook/session churn in heavily customized local areas |
| `01a1b141` | skip | low marginal value, local subagent resolver already rejects primaries effectively |

## Local integration note: wait-for-task-session

`80d3339c` is worth adopting, but only as a local integration.

### Why it matters

The local fork still has a manual blocking loop in:

- `src/tools/background-task/create-background-output.ts`

The upstream helper waits for a task to receive a session ID. That is useful here because session linkage and output retrieval can race.

### Recommended local port

1. Add upstream helper logic as `src/features/background-agent/wait-for-task-session.ts`
2. Export it from `src/features/background-agent/index.ts`
3. Call it from `src/tools/background-task/create-background-output.ts` before or alongside the blocking output/session wait path
4. Reuse it later in other task/session-link recovery flows if needed

### Do not do only this

Do not cherry-pick `80d3339c` without wiring it in. The helper by itself does not improve behavior unless the local blocking path actually uses it.

## Deep check: risky hook-layer churn

The most dangerous upstream area is not delegate-task. It is the continuation and session-lifecycle layer around these local systems:

- Atlas
- todo continuation enforcer
- preemptive compaction
- hook message injection
- Boulder state tracking
- session/agent resolution

Those systems are tightly coupled locally.

### Local files that make this area fragile

#### Atlas and session ownership

- `src/hooks/atlas/atlas-hook.ts`
- `src/hooks/atlas/event-handler.ts`
- `src/hooks/atlas/session-last-agent.ts`

Local behavior depends on exact lifecycle semantics of:

- `session.idle`
- `session.error`
- `message.updated`
- `message.part.updated`
- `session.compacted`

Atlas also deletes or resets local state on compaction and deletion events. Any upstream change to event timing or payload shape can change continuation behavior.

#### Todo continuation and continuation injection

- `src/hooks/todo-continuation-enforcer/idle-event.ts`
- `src/hooks/todo-continuation-enforcer/resolve-message-info.ts`
- `src/hooks/todo-continuation-enforcer/continuation-injection.ts`
- `src/plugin/hooks/create-continuation-hooks.ts`

This layer depends on:

- fetching session messages with local agent/model resolution
- skip-agent logic that treats compaction specially
- a compaction guard epoch in session state
- injecting prompts with `ctx.client.session.promptAsync`
- preserving agent/model/tools across continuation injections

Any upstream changes here must be treated as manual ports, because local continuation logic already extends upstream behavior significantly.

#### Compaction and post-compaction recovery

- `src/hooks/preemptive-compaction.ts`
- `src/hooks/preemptive-compaction-degradation-monitor.ts`
- `src/features/background-agent/compaction-aware-message-resolver.ts`

This fork has more than one compaction-related mechanism:

- proactive compaction triggering
- post-compaction degradation recovery
- compaction-aware agent/model resolution

That means upstream compaction fixes may be good, but direct merges can easily conflict with local assumptions about message history and recovery state.

#### Message injection and session context recovery

- `src/features/hook-message-injector/injector.ts`
- `src/plugin/chat-message.ts`
- `src/plugin/tool-execute-after.ts`

This fork already has custom logic for:

- Graphify context injection
- JSON-vs-SQLite message lookup
- internal initiator markers
- direct prompt injection with inherited tools
- metadata-based recovery of task/session links

This is a major reason not to blindly merge upstream hook changes.

#### Boulder progress tracking and command routing

- `src/features/boulder-state/storage.ts`
- `src/plugin-handlers/command-config-handler.ts`
- `src/hooks/start-work/start-work-hook.ts`

Local Boulder progress parsing is still simple checkbox counting. Upstream improved this area enough that selective manual integration is probably worth it.

## Commit-by-commit hook-layer assessment

### `78e6d780` fix(plugin): verify event hook compatibility with v1.4.0

**Verdict:** do not cherry-pick whole commit. Manually port selected pieces.

**Why upstream changed it:**

It touches all of the local weak points at once:

- compaction-aware message resolution
- hook message injector
- atlas session-last-agent
- todo continuation idle behavior and message-info resolution
- compaction markers

**Why it is risky here:**

The local fork already has custom behavior in each of those files. A full cherry-pick would likely overwrite or subtly change:

- how compaction events are detected
- how agent/model context is reconstructed
- how continuation gets skipped or retriggered
- how session cleanup happens on compaction

**Manual-port recommendation:**

Port only the behavior that clearly improves compatibility with newer event payloads:

1. safer message-info resolution when compaction messages appear in history
2. better session-last-agent fallback for SQLite-backed sessions
3. more robust hook-message resolution when SDK payloads omit fields temporarily
4. compaction marker support if it improves local post-compaction disambiguation

**Local files to inspect during port:**

- `src/features/background-agent/compaction-aware-message-resolver.ts`
- `src/features/hook-message-injector/injector.ts`
- `src/hooks/atlas/session-last-agent.ts`
- `src/hooks/todo-continuation-enforcer/resolve-message-info.ts`
- `src/hooks/todo-continuation-enforcer/idle-event.ts`
- `src/plugin/chat-params.ts`

### `43941296` fix(compaction): harden continuation directive markers

**Verdict:** manual port, high value

**Why it matters locally:**

Local directive/marker handling is simple:

- `src/shared/internal-initiator-marker.ts`
- `src/shared/system-directive.ts`

The local versions do not yet contain the more defensive marker handling upstream added. This is a good target because it is small and clearly related to continuation/compaction hygiene.

**Manual-port recommendation:**

Strengthen marker detection so compaction and continuation prompts are less likely to be misinterpreted as user-originated messages or to retrigger keyword-based automation.

### `8090ee6a` fix(compaction): persist recovery cap across cycles

**Verdict:** likely cherry-pick or tiny manual port

**Why it matters locally:**

This is a one-line change in `src/hooks/preemptive-compaction-degradation-monitor.ts`. Because the local monitor is heavily customized but the diff is tiny, this is probably safe to port directly after verifying the surrounding semantics still match.

### `9287abe1` fix(stop-continuation): clear chat.message fallback stop state before work resumes

**Verdict:** manual port, medium value

**Why it matters locally:**

`src/plugin/chat-message.ts` already runs a long sequence of hook handlers, including stop-continuation and start-work related logic. If the local fork sometimes retains stop state too long, this upstream change is useful.

**Why not cherry-pick directly:**

Local `chat-message.ts` also injects Graphify context, stores session models, manages Ralph loop templates, and runs custom hook ordering. Port behavior, not raw diff.

### `c9461a90` fix(stop-continuation): scope start-work clearing to fallback template

**Verdict:** manual port, medium value

**Why it matters locally:**

This is another `chat-message.ts` lifecycle correctness fix. It likely interacts with custom `/start-work` and planning behavior.

**Recommendation:** review together with `9287abe1`, not separately.

### `0ab2370d` fix(start-work): add checked checkbox pattern for plan progress tracking

**Verdict:** manual port, high value

**Why it matters locally:**

Local `src/features/boulder-state/storage.ts` still uses simple regex counting:

- unchecked: `- [ ]`
- checked: `- [x]`

It does not distinguish structured plan formats from simple markdown plans. Upstream’s improvements here are useful because Boulder state is part of the local continuation system.

### `e8c8376d` fix(boulder): support both structured and simple plan formats in getPlanProgress

**Verdict:** manual port, high value

**Why it matters locally:**

This is the bigger companion to `0ab2370d`. It gives Boulder progress parsing better shape-awareness instead of only counting raw checkboxes.

**Recommendation:** port with `0ab2370d` as a single manual change set.

### `0cb938e3` fix(boulder): count only top-level checkboxes in simple-mode plan progress

**Verdict:** manual port, medium-high value

**Why it matters locally:**

The local parser currently counts any markdown checkbox match. If nested subtasks are common in local plans, progress can be overstated.

**Recommendation:** port together with `0ab2370d` and `e8c8376d`.

### `24629643`, `8925ec3a`, `cd95172e` start-work / command routing fixes

**Verdict:** review together, likely manual port subset

**Why they matter locally:**

These changes sit in command/agent routing:

- `src/plugin-handlers/command-config-handler.ts`
- start-work command resolution logic

The local command config handler already remaps agent fields through `getAgentDisplayName()`. Upstream fixes around canonical display names and config keys may still matter, but this is not a good candidate for blind cherry-picks.

**Recommendation:**

Review these only after the higher-value continuation and Boulder fixes. Port only if start-work or native command routing is showing mismatches.

## Manual integration plan for risky hook/session changes

### Phase 1: small, isolated correctness ports

1. `43941296` continuation directive markers
2. `8090ee6a` compaction recovery-cap persistence
3. selected pieces of `78e6d780` that improve message-info and compaction-aware resolution

### Phase 2: Boulder plan progress correctness

Port these together as one local change:

1. `0ab2370d`
2. `e8c8376d`
3. `0cb938e3`

Target local file first:

- `src/features/boulder-state/storage.ts`

### Phase 3: chat-message stop/start lifecycle fixes

Review and likely port behavior from:

1. `9287abe1`
2. `c9461a90`

Target local file:

- `src/plugin/chat-message.ts`

### Phase 4: command-routing parity, only if needed

Review and port only on evidence of routing issues:

1. `24629643`
2. `8925ec3a`
3. `cd95172e`

Target local files:

- `src/plugin-handlers/command-config-handler.ts`
- start-work routing files

## Files to watch closely during any risky upgrade

- `src/hooks/atlas/event-handler.ts`
- `src/hooks/atlas/session-last-agent.ts`
- `src/hooks/todo-continuation-enforcer/idle-event.ts`
- `src/hooks/todo-continuation-enforcer/resolve-message-info.ts`
- `src/hooks/todo-continuation-enforcer/continuation-injection.ts`
- `src/hooks/preemptive-compaction.ts`
- `src/hooks/preemptive-compaction-degradation-monitor.ts`
- `src/features/background-agent/compaction-aware-message-resolver.ts`
- `src/features/hook-message-injector/injector.ts`
- `src/features/boulder-state/storage.ts`
- `src/plugin/chat-message.ts`
- `src/plugin/hooks/create-continuation-hooks.ts`

## Recommended validation after each integration batch

After each batch, run at minimum:

1. relevant targeted tests for touched modules
2. `bun test` for continuation / hook / Boulder suites if the targeted tests are not enough
3. `bun run typecheck`
4. `bun run build`

For hook-layer changes, also verify behavior manually where possible:

- session continues only when expected
- compaction does not immediately retrigger stale continuation
- Boulder progress is not inflated by nested checkboxes
- start-work and stop-continuation do not leave sticky state behind

## Execution-ready manual integration task list

Use this section as the implementation checklist for the risky upstream batches that should not be cherry-picked directly.

### Batch A: continuation directive and marker hardening

**Upstream source:** `43941296`

**Goal:**

Make internal continuation and compaction directives less likely to be mistaken for user content or to retrigger local automation incorrectly.

**Primary local files to edit:**

- `src/shared/internal-initiator-marker.ts`
- `src/shared/system-directive.ts`
- any local consumers that inspect system-reminder or internal-initiator text

**Expected conflict points:**

- marker format changes can affect keyword detection and system-message filtering
- local Graphify/session-context injection also uses internal text parts and must remain compatible

**What to port:**

- more defensive detection and normalization of internal markers
- stricter system-directive parsing and filtering helpers if they reduce false positives

**Validation:**

- targeted tests for marker/system-directive helpers
- keyword detector tests if marker handling affects prompt classification
- `bun run typecheck`

### Batch B: compaction recovery loop guard

**Upstream source:** `8090ee6a`

**Goal:**

Keep compaction recovery caps consistent across repeated degradation cycles.

**Primary local files to edit:**

- `src/hooks/preemptive-compaction-degradation-monitor.ts`

**Expected conflict points:**

- local monitor already tracks epochs, no-text streaks, and source model state
- seemingly tiny state changes here can alter when recovery re-fires

**What to port:**

- the recovery-cap persistence behavior only

**Validation:**

- targeted compaction degradation monitor tests
- preemptive compaction tests if recovery state is shared
- `bun run typecheck`

### Batch C: event-hook compatibility subset

**Upstream source:** `78e6d780`

**Goal:**

Improve compatibility with newer OpenCode event/message payloads without replacing the fork's custom continuation model.

**Primary local files to inspect and possibly edit:**

- `src/features/background-agent/compaction-aware-message-resolver.ts`
- `src/features/hook-message-injector/injector.ts`
- `src/hooks/atlas/session-last-agent.ts`
- `src/hooks/todo-continuation-enforcer/resolve-message-info.ts`
- `src/hooks/todo-continuation-enforcer/idle-event.ts`
- `src/plugin/chat-params.ts`

**Expected conflict points:**

- Atlas clears state on `session.compacted` and `session.deleted`
- todo continuation uses local compaction epochs and skip-agent logic
- JSON and SQLite message reconstruction already diverge locally
- any changes in agent/model resolution can alter which agent resumes a session

**What to port:**

- safer compaction-aware message tail parsing
- stronger SQLite/session.messages fallback for agent ownership resolution
- tolerant handling when event payloads temporarily omit agent or model fields
- compaction marker logic only if it helps local post-compaction disambiguation

**Do not port blindly:**

- wholesale state-reset behavior
- any change that assumes upstream hook ordering now matches local continuation ordering

**Validation:**

- atlas tests
- todo-continuation-enforcer tests
- hook-message-injector tests
- manual verification: compact a session, then ensure continuation resumes the correct agent and does not duplicate prompts

### Batch D: Boulder progress parsing upgrade

**Upstream source:** `0ab2370d`, `e8c8376d`, `0cb938e3`

**Goal:**

Make Boulder progress tracking accurate for both simple and structured plans, and avoid inflated completion counts from nested checkboxes.

**Primary local files to edit:**

- `src/features/boulder-state/storage.ts`
- possibly `src/hooks/start-work/start-work-hook.ts` if assumptions about `PlanProgress` behavior change
- possibly `src/hooks/atlas/tool-execute-after.ts` if output reminders depend on progress semantics

**Expected conflict points:**

- local `getPlanProgress()` currently counts all markdown checkboxes
- local start-work and Atlas reminders read `PlanProgress` directly and may assume simple totals

**What to port:**

- checked checkbox pattern support
- structured-vs-simple plan parsing logic
- top-level-only counting in simple-mode progress

**Validation:**

- `src/features/boulder-state/storage.test.ts`
- `src/hooks/start-work/index.test.ts`
- Atlas tests that check progress text or gating behavior
- manual verification with a plan that contains nested checkboxes

### Batch E: stop-continuation and chat-message lifecycle fixes

**Upstream source:** `9287abe1`, `c9461a90`

**Status:** ✅ **VERIFIED UNNECESSARY** (2026-04-21)

**Goal:**

Clear stale stop-continuation state at the right time, without interfering with start-work / planning fallback flows.

**Primary local files to edit:**

- `src/plugin/chat-message.ts`
- any stop-continuation state helpers referenced by chat-message hook ordering
- optionally `src/plugin/hooks/create-continuation-hooks.ts` if lifecycle coordination needs to move

**Expected conflict points:**

- local `chat-message.ts` already does Graphify injection, model persistence, keyword handling, Ralph loop parsing, start-work/start-planning/start-writing dispatch, and continuation-related hook calls
- hook ordering changes can easily create sticky state or double-clears

**What to port:**

- behavior to clear stale continuation stop state when genuine work resumes
- narrower scoping so start-work fallback/template prompts do not clear stop state incorrectly

**Current local assessment:**

**VERIFIED:** The current fork already clears stop state on any new `chat.message` via `src/hooks/stop-continuation-guard/hook.ts` (lines 98-108), which is called from `src/plugin/chat-message.ts` (line 189) **before** the start-work and Ralph loop handlers run.

The local implementation is **more aggressive** than upstream - it clears on ANY new message, not just specific work-resumption scenarios. This means:
- ✅ Stop state is cleared when users send new messages
- ✅ No sticky state remains after stopping continuation
- ✅ The upstream fixes from `9287abe1` and `c9461a90` are **not required** for parity

**Recommendation:** Skip Batch E entirely. If the current behavior proves too broad (clearing stop state in scenarios where it should persist), revisit as a narrowing/refinement pass rather than a missing-fix port.

**Validation completed:**

- ✅ `src/hooks/stop-continuation-guard/index.test.ts` - 10 tests passing
- ✅ `src/hooks/atlas/` - 92 tests passing (integration with continuation)
- ✅ `src/hooks/todo-continuation-enforcer/` - 78 tests passing
- ✅ `src/features/boulder-state/` - 45 tests passing
- ✅ `bun run build` - successful
- ✅ `bun run typecheck` - clean

### Batch F: command-routing and start-work parity

**Upstream source:** `24629643`, `8925ec3a`, `cd95172e`

**Goal:**

Align command routing with canonical agent/config keys only if local start-work routing shows mismatches.

**Primary local files to inspect:**

- `src/plugin-handlers/command-config-handler.ts`
- `src/hooks/start-work/start-work-hook.ts`
- related start-work command routing tests

**Expected conflict points:**

- local command config handler already remaps command agent fields with `getAgentDisplayName()`
- local start-work updates the session agent to Atlas and writes Boulder state; routing changes can alter how that handoff happens

**What to port:**

- only the pieces needed to keep native command agents on config keys and resolve canonical display names correctly

**Validation:**

- command-config-handler tests
- start-work tests
- plugin-interface tests that assert routed agent names

## Suggested implementation order

1. Batch A: marker hardening
2. Batch B: compaction recovery cap
3. Batch D: Boulder progress parsing
4. Batch C: selected event-hook compatibility fixes
5. Batch E: stop-continuation / chat-message lifecycle fixes
6. Batch F: command-routing parity, only if evidence of breakage remains

## Recommended commands after each batch

Run the narrowest relevant test set first, then broaden if needed.

Minimum for every batch:

```bash
bun run typecheck
bun run build
```

Recommended by area:

- continuation / Atlas / compaction changes:
  ```bash
  bun test src/hooks/atlas src/hooks/todo-continuation-enforcer src/hooks/preemptive-compaction* src/features/hook-message-injector
  ```

- Boulder and start-work changes:
  ```bash
  bun test src/features/boulder-state src/hooks/start-work src/hooks/atlas/tool-execute-after.ts src/plugin/chat-message.test.ts
  ```

- command routing changes:
  ```bash
  bun test src/plugin-handlers/command-config-handler.test.ts src/plugin-interface.test.ts src/hooks/start-work
  ```

If targeted suites are noisy or incomplete, run full verification:

```bash
bun test
bun run typecheck
bun run build
```
