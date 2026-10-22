#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventBus } from './event-bus.js';
import { registerHooks } from './hook-registry.js';
import { OrchestratorAgent } from '../agents/orchestrator.js';
import { MonitoringAgent } from '../agents/monitoring.js';
import { MigrationAgent } from '../agents/migration.js';
import { CodeScanAgent } from '../agents/codescan.js';
import { QaAgent } from '../agents/qa.js';
import { DevOpsAgent } from '../agents/devops.js';
import { DocsAgent } from '../agents/docs.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(readFileSync(join(root, file), 'utf8'));

const USAGE = `Usage: node orchestrator/cli.js <command> [options]

Commands
  run                       full pipeline (init → loop 1 → loop 2 → deploy)
  agent:orchestrate:init    Step 0 only (dispatch + monitoring start)
  agent:monitor:watch | agent:migration:run | agent:codescan:analyze
  agent:qa:e2e | agent:qa:unit | agent:devops:deploy | agent:docs:sync
                            run one agent (its hooks still fire, so the chain continues)
  skills:install            install the 5 skills (add --dry-run to only print the commands)

Options
  --mode=simulate|real      override config/pipeline.json mode
  --fail-scan=N             simulate: first N code scans return KO
  --fail-qa=N               simulate: first N QA runs fail
  --fast                    no simulated delay
  --no-push | --no-commit   real mode: docs agent commits only / does not commit
`;

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = Object.fromEntries(
    rest.filter((a) => a.startsWith('--')).map((a) => {
      const [k, v = 'true'] = a.slice(2).split('=');
      return [k, v];
    })
  );
  return { command, flags };
}

function installSkills(dryRun) {
  let failed = 0;
  for (const { repo, skill } of readJson('config/skills.json')) {
    const cmd = `npx skills add ${repo} --skill ${skill}`;
    console.log(`> ${cmd}`);
    if (dryRun) continue;
    if (spawnSync(cmd, { cwd: root, shell: true, stdio: 'inherit' }).status !== 0) {
      failed += 1;
      console.warn(`  ! skill "${skill}" failed to install (continuing)`);
    }
  }
  if (failed) console.warn(`${failed} skill(s) failed — see warnings above.`);
}

async function buildContext(flags) {
  const config = readJson('config/pipeline.json');
  if (flags.mode) config.mode = flags.mode;
  if (flags['fail-scan']) config.simulate.failScan = Number(flags['fail-scan']);
  if (flags['fail-qa']) config.simulate.failQa = Number(flags['fail-qa']);
  if (flags.fast) config.simulate.delayMs = 0;
  if (flags['no-push']) config.docs.push = false;
  if (flags['no-commit']) config.docs.commit = false;

  const ctx = {
    root,
    config,
    agentsConfig: readJson('config/agents.json'),
    bus: new EventBus(join(root, 'logs', 'events.jsonl')),
    agents: {},
    hooks: [],
    state: {
      statuses: {},
      loops: { scan: 0, qa: 0 },
      scanCount: 0,
      qaCount: 0,
      lastEvent: null,
      outcome: null
    }
  };
  ctx.agents = {
    orchestrator: new OrchestratorAgent(ctx),
    monitoring: new MonitoringAgent(ctx),
    migration: new MigrationAgent(ctx),
    codescan: new CodeScanAgent(ctx),
    qa: new QaAgent(ctx),
    devops: new DevOpsAgent(ctx),
    docs: new DocsAgent(ctx)
  };
  ctx.bus.on('*', (_payload, event) => {
    if (event.type !== 'hook:status-update') ctx.state.lastEvent = event.type;
  });
  await registerHooks(ctx);
  return ctx;
}

const { command, flags } = parseArgs(process.argv.slice(2));

if (!command || command === 'help' || command === '--help') {
  console.log(USAGE);
} else if (command === 'skills:install') {
  installSkills(flags['dry-run'] === 'true');
} else {
  const ctx = await buildContext(flags);
  const { agents } = ctx;
  const single = {
    'agent:orchestrate:init': () => agents.orchestrator.init(),
    'agent:monitor:watch': () => agents.monitoring.watch(),
    'agent:migration:run': () => agents.migration.run(),
    'agent:codescan:analyze': () => agents.codescan.analyze(),
    'agent:qa:e2e': () => agents.qa.e2e(),
    'agent:qa:unit': () => agents.qa.unit(),
    'agent:devops:deploy': () => agents.devops.deploy(),
    'agent:docs:sync': () => agents.docs.sync()
  };
  if (command === 'run') {
    const outcome = await agents.orchestrator.run();
    console.log(`\nPipeline ${outcome === 'success' ? 'SUCCEEDED' : 'FAILED'} — journal: logs/events.jsonl, report: logs/report.md`);
    process.exitCode = outcome === 'success' ? 0 : 1;
  } else if (single[command]) {
    await agents.monitoring.watch();
    await single[command]();
  } else {
    console.error(`Unknown command: ${command}\n\n${USAGE}`);
    process.exitCode = 2;
  }
}
