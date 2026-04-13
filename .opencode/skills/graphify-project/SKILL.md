---
name: graphify-project
description: "Initialize or refresh Graphify artifacts for the current project. Use when the repo needs graphify-out created or updated before graph-aware exploration. Keeps work project-local; no global AGENTS.md changes required."
---

# Graphify Project

Use this skill when a project needs Graphify artifacts created or refreshed.

## Purpose

- Create `graphify-out/` for the current project when it does not exist.
- Refresh `graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json` when the repo changed.
- Keep all Graphify setup local to this project.

## Expected workflow

1. Check whether `graphify-out/graph.json` already exists.
2. If it exists and is fresh enough for the task, keep it.
3. If it is missing or stale, run the local Graphify workflow for this repo.
4. Verify these artifacts exist afterward:
   - `graphify-out/graph.json`
   - `graphify-out/GRAPH_REPORT.md`
5. Report what was created or refreshed and any follow-up needed.

## Commands

Prefer project-local Graphify commands already available in the environment. Typical examples:

```bash
graphify .
```

If the project uses a different wrapper or script, use that instead.

## Guardrails

- Do not modify root `AGENTS.md` unless explicitly asked.
- Do not invent Graphify outputs; verify files exist.
- If Graphify is unavailable in the environment, report that clearly instead of guessing.
- If the repo is too large for a safe run, stop and report the constraint.
