import { Agent } from './_base.js';

export class QaAgent extends Agent {
  constructor(ctx) {
    super(ctx, 'qa');
  }

  /** agent:qa:e2e */
  e2e(simulatedOk = true) {
    return this.work('qaE2e', simulatedOk);
  }

  /** agent:qa:unit */
  unit(simulatedOk = true) {
    return this.work('qaUnit', simulatedOk);
  }

  /** Loop 2 entry: runs E2E then unit tests; any failure fires hook:on-qa-failure. */
  async run() {
    const { state, config } = this.ctx;
    state.qaCount += 1;
    state.loops.qa += 1;
    const simulatedOk = state.qaCount > config.simulate.failQa;

    await this.setStatus('on execution', `E2E (run #${state.qaCount})`);
    const e2eOk = await this.e2e(simulatedOk);
    await this.setStatus('on execution', `unit tests (run #${state.qaCount})`);
    const unitOk = await this.unit(simulatedOk);

    const ok = e2eOk && unitOk;
    const failures = [!e2eOk && 'e2e', !unitOk && 'unit'].filter(Boolean);
    if (ok) {
      await this.setStatus('done', 'E2E + unit 100% OK');
      await this.emit('qa:passed', { run: state.qaCount });
      return this.ctx.agents.devops.deploy();
    }
    await this.setStatus('blocked', `failed: ${failures.join(', ')}`);
    await this.ctx.bus.emit('hook:on-qa-failure', { agent: this.id, failures, run: state.qaCount });
  }
}
