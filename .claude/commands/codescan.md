---
description: Quality gate — get a VERDICT OK/KO from the codescan agent
argument-hint: [paths or focus — default: current git diff]
---
Use the `codescan` agent to review: $ARGUMENTS

If no target is given, review the current `git diff` (including untracked files). Show the verdict and findings unchanged. On `KO`, offer to send the findings verbatim to the `migration` agent (Loop 1); on `OK`, suggest `/qa`.
