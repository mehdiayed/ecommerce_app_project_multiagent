import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Agent } from './_base.js';
import { createPrinter, renderMatrix } from '../scripts/monitor-matrix.js';

export class MonitoringAgent extends Agent {
  constructor(ctx) {
    super(ctx, 'monitoring');
    this.watching = false;
    this.print = createPrinter();
  }

  /** agent:monitor:watch — start rendering the live matrix. */
  async watch() {
    this.watching = true;
    await this.setStatus('on execution', 'watching all agents');
  }

  /** Called by hook:status-update. Records the change, persists it and redraws. */
  record({ agent, status, detail }) {
    this.ctx.state.statuses[agent] = { status, detail };
    this.persist();
    if (this.watching) this.print(renderMatrix(this.snapshot()));
  }

  snapshot() {
    const { statuses, loops, lastEvent } = this.ctx.state;
    return {
      agents: Object.keys(this.ctx.agentsConfig).map((id) => ({
        id,
        label: this.ctx.agentsConfig[id].label,
        status: statuses[id]?.status ?? 'waiting',
        detail: statuses[id]?.detail ?? ''
      })),
      loops,
      lastEvent
    };
  }

  persist() {
    writeFileSync(join(this.ctx.root, 'logs', 'status.json'), JSON.stringify(this.snapshot(), null, 2));
  }

  /** Closes the mission: final status, report on disk, matrix stops redrawing. */
  async close(outcome, summary) {
    await this.setStatus(outcome === 'success' ? 'done' : 'blocked', summary);
    this.watching = false;
    const lines = [
      `# Pipeline report — ${outcome.toUpperCase()}`,
      '',
      `- Task: ${this.ctx.config.task}`,
      `- Mode: ${this.ctx.config.mode}`,
      `- Summary: ${summary}`,
      `- Scans run: ${this.ctx.state.scanCount} · QA runs: ${this.ctx.state.qaCount}`,
      '',
      '| Agent | Final status | Detail |',
      '|---|---|---|',
      ...this.snapshot().agents.map((a) => `| ${a.label} | ${a.status} | ${a.detail} |`)
    ];
    writeFileSync(join(this.ctx.root, 'logs', 'report.md'), lines.join('\n') + '\n');
  }
}
