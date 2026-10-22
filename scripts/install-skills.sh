#!/usr/bin/env bash
# Installs the skills required by the agents. A failing skill only warns.
# Usage: scripts/install-skills.sh [--dry-run]
cd "$(dirname "$0")/.." || exit 1
run() {
  echo "> $*"
  [ "$DRY" = "1" ] && return 0
  "$@" || echo "  ! failed: $* (continuing)"
}
[ "$1" = "--dry-run" ] && DRY=1

# Agent 3 — Migration & Feature
run npx skills add https://github.com/anthropics/skills --skill frontend-design
# Agent 4 — Code Scan & Health
run npx skills add https://github.com/membranedev/application-skills --skill codescene
# Agent 5 — QA
run npx skills add https://github.com/openai/skills --skill playwright
run npx skills add https://github.com/rushuiguan/claude --skill csharp-unit-test
# Agent 6 — DevOps
run npx skills add https://github.com/lukasniessen/kubernetes-skill --skill kubernetes-skill
