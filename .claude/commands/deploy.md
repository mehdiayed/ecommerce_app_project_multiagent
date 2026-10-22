---
description: Prepare and validate deployment manifests with the devops agent (dry-run only)
argument-hint: [services touched / notes]
---
Check that the latest QA result was `PASS` (100%). If it was not, or you cannot tell, stop and say so.

Otherwise use the `devops` agent for: $ARGUMENTS

Show its `DEPLOY:` line. `READY` is only valid if Dockerfiles/manifests exist and were validated: if the repo has none, the agent must create them (or answer `BLOCKED`), never a vacuous `READY`. Do not apply anything to a real cluster unless I confirm explicitly; after a confirmed apply, smoke-test (Blazor interactivity, inter-service calls), not just pod status. When ready, suggest `/docs-sync`.
