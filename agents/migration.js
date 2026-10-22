import { Agent } from './_base.js';

export class MigrationAgent extends Agent {
  constructor(ctx) {
    super(ctx, 'migration');
  }

  /**
   * agent:migration:run — implement features / DB migrations / UI, then hand over to Code Scan.
   * `reason`: initial | scan-rejected | qa-failure (drives the status detail only).
   */
  async run({ reason = 'initial', feedback } = {}) {
    const { agents } = this.ctx;
    await agents.qa.setStatus('on hold', 'waiting for a clean scan');
    await this.setStatus('on execution', reason === 'initial' ? 'implementing feature' : `fixing (${reason})`);
    const ok = await this.work('migration');
    await this.emit('migration:completed', { reason, ok, feedback });
    if (!ok) {
      await this.setStatus('blocked', 'migration command failed');
      return agents.orchestrator.fail('Migration command failed');
    }
    await this.setStatus('done', 'handed over to Code Scan');
    await agents.codescan.analyze();
  }
}
