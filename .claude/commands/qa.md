---
description: Run QA — unit and/or E2E tests via the qa agent
argument-hint: [unit|e2e|all] <feature / acceptance criteria>
---
Use the `qa` agent. Scope and feature: $ARGUMENTS

`unit` → unit tests only (`agent:qa:unit`), `e2e` → Playwright only (`agent:qa:e2e`), `all` or no scope → both. Show the `QA RESULT` block unchanged. On `FAIL`, offer to send the failures verbatim to the `migration` agent (Loop 2) and then re-run `/codescan` and `/qa`; on `PASS`, suggest `/deploy`.
