# Installs the skills required by the agents. A failing skill only warns.
# Usage: scripts\install-skills.ps1 [-DryRun]
param([switch]$DryRun)
Set-Location (Join-Path $PSScriptRoot '..')

$skills = @(
  @('https://github.com/anthropics/skills', 'frontend-design'),                          # Agent 3 - Migration
  @('https://github.com/membranedev/application-skills', 'codescene'),                   # Agent 4 - Code Scan
  @('https://github.com/openai/skills', 'playwright'),                                   # Agent 5 - QA
  # csharp-unit-test, k8s-manifests, deploy-verify are project skills in .claude/skills/ (no install needed)
  @('https://github.com/lukasniessen/kubernetes-skill', 'kubernetes-skill')              # Agent 6 - DevOps
)

foreach ($s in $skills) {
  Write-Host "> npx skills add $($s[0]) --skill $($s[1])"
  if ($DryRun) { continue }
  npx skills add $s[0] --skill $s[1]
  if ($LASTEXITCODE -ne 0) { Write-Warning "skill $($s[1]) failed (continuing)" }
}
