---
description: Sync README, docs/ and .excalidraw diagrams with the code, then commit (add "push" to also push)
argument-hint: [push]
---
Use the `docs` agent (`agent:docs:sync`) to synchronise `README.md`, `docs/TECHNICAL.md` and `docs/diagrams/*.excalidraw` with the current code, and commit with the message `docs: automatic sync post-deployment`.

Arguments: $ARGUMENTS
Push only if the arguments contain the word `push`; otherwise leave the commit local and tell me. Show the files updated and the commit hash.
