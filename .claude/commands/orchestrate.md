---
description: Run the full multi-agent cycle for a feature (plan → Migration ⇄ Code Scan → QA → DevOps → Docs & Sync)
argument-hint: <feature description> [push]
---
You are the **Orchestrator**. Sub-agents cannot call other sub-agents, so YOU (the main session) run this cycle by delegating each step to a sub-agent with the Agent tool, and you own the loops, the status matrix and the run log.

**Feature:** $ARGUMENTS
(If the arguments end with the word `push`, the Docs step may push; otherwise it only commits locally.)

## Status matrix
Keep this table and **print it after every step** (🟡 `on execution` · 🔵 `on hold` · 🟢 `done` · 🔴 `blocked` · ⚪ `waiting`). Also append one line per event to `logs/pipeline-run.md` (create the folder if needed): `<time> | <agent> | <status> | <detail>`.

| Agent | Status | Detail |
|---|---|---|
| Orchestrator | | |
| Monitoring | | |
| Migration | ⚪ waiting | |
| Code Scan | ⚪ waiting | |
| QA | ⚪ waiting | |
| DevOps | ⚪ waiting | |
| Docs & Sync | ⚪ waiting | |

Counters: Loop 1 (Migration ⇄ Code Scan) max **5** iterations per pass; Loop 2 (QA → Migration) max **3** iterations.

## Steps
**Step 0 — dispatch** (`hook:on-task-dispatch`). Set Orchestrator and Monitoring to 🟡. Delegate to the `orchestrator` agent to plan the feature; show the plan. Ask the user only if the feature is too ambiguous to plan.

**Step 1 — Migration** (`agent:migration:run`). Migration 🟡, QA/DevOps/Docs 🔵 on hold. Delegate to `migration` with the plan step for it. It must report a passing `dotnet build`. Build fails and cannot be fixed → Migration 🔴, stop.

**Step 2 — Code Scan** (`agent:codescan:analyze`, `hook:on-scan-complete`). Delegate to `codescan` with the changed files.
- `VERDICT: KO` → Code Scan 🔴 (`hook:on-code-rejected`): delegate to `migration` with the findings **verbatim**, then repeat Step 2. **Loop 1.** Past 5 iterations → stop, both 🔴, summarise remaining findings for the user.
- `VERDICT: OK` → Code Scan 🟢, continue.

**Step 3 — QA** (`agent:qa:e2e`, `agent:qa:unit`). Delegate to `qa` with the acceptance criteria.
- `QA RESULT: FAIL` → QA 🔴 (`hook:on-qa-failure`): delegate to `migration` with the failures verbatim, then **go back to Step 2** (Loop 1 restarts at 0). **Loop 2.** Past 3 iterations → stop, QA 🔴.
- `QA RESULT: PASS` (100%) → QA 🟢, continue.

**Step 4 — DevOps** (`agent:devops:deploy`). Delegate to `devops`. It validates only (dry-run), but first checks that Dockerfiles/manifests exist; if none exist, tell it to create them (never accept a `READY` that validated nothing). `DEPLOY: READY` → DevOps 🟢 and emit `hook:on-pipeline-success`. If the user wants a real deployment, ask for confirmation before anything is applied. `BLOCKED` → 🔴, stop.

**Step 5 — Docs & Sync** (`hook:on-deploy-validated` → `agent:docs:sync`). Delegate to `docs`; tell it whether `push` was requested. Docs failure does not undo the delivery: mark it 🔴 and report it.

**Step 6 — close.** Orchestrator and Monitoring 🟢 (or 🔴 on failure). Print the final matrix, loop counts, files changed, test results, the commit hash and push state, and save the same summary to `logs/pipeline-report.md`.

## Rules
- Never skip a gate: no QA before Code Scan is OK, no DevOps before QA is 100% PASS.
- Pass findings and failures between agents **verbatim**, not summarised.
- Do not push, deploy to a cluster, or take other outward-facing actions without the user's confirmation, except the explicit `push` argument.
