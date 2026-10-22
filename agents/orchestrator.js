import { Agent } from './_base.js';

export class OrchestratorAgent extends Agent {
  constructor(ctx) {
    super(ctx, 'orchestrator');
  }

  /** agent:orchestrate:init — Step 0: dispatch the task, which starts monitoring. */
  async init() {
    await this.setStatus('on execution', 'initialising pipeline');
    for (const id of ['migration', 'codescan', 'qa', 'devops', 'docs']) {
      await this.ctx.agents[id].setStatus('waiting');
    }
    await this.emit('task:init', { task: this.ctx.config.task });
    await this.ctx.bus.emit('hook:on-task-dispatch', { task: this.ctx.config.task });
  }

  /** Full pipeline: init, then the event chain (loop 1 / loop 2 / deploy) runs to completion. */
  async run() {
    await this.init();
    await this.setStatus('on execution', 'dispatching to Migration');
    await this.ctx.agents.migration.run({ reason: 'initial' });
    return this.ctx.state.outcome;
  }

  /** Aborts the mission (loop budget exhausted). */
  async fail(summary) {
    this.ctx.state.outcome = 'failed';
    await this.setStatus('blocked', summary);
    await this.ctx.agents.monitoring.close('failed', summary);
  }
}
