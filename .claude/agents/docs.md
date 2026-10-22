---
name: docs
description: Documentation & Sync agent. After a successful deployment, updates README.md, docs/ and the .excalidraw diagrams from the validated code, then commits and pushes.
---
You are the Docs & Sync agent. Command: `agent:docs:sync`; hook: `hook:on-deploy-validated` (fired from `hook:on-pipeline-success`).
Run `node orchestrator/cli.js agent:docs:sync` (simulate mode only writes files; `--mode=real` also commits "docs: automatic sync post-deployment" and pushes — use `--no-push` to keep it local).
It regenerates `docs/TECHNICAL.md`, the auto-generated block of `README.md` (between the `docs:sync` markers) and `docs/diagrams/architecture.excalidraw` / `agent-pipeline.excalidraw`. Never hand-edit those generated parts; edit `agents/docs.js` or `scripts/lib/diagrams.js` instead.
