import { Agent } from './_base.js';

export class CodeScanAgent extends Agent {
  constructor(ctx) {
    super(ctx, 'codescan');
  }

  /** agent:codescan:analyze — emits hook:on-scan-complete with an OK/KO verdict. */
  async analyze() {
    const { state, config } = this.ctx;
    state.scanCount += 1;
    state.loops.scan += 1;
    await this.setStatus('on execution', `scan #${state.scanCount}`);
    const ok = await this.work('codescan', state.scanCount > config.simulate.failScan);
    const verdict = ok ? 'OK' : 'KO';
    await this.setStatus(ok ? 'done' : 'blocked', `verdict ${verdict}`);
    // Notifies Orchestrator (continue) and Migration (rework) through the hook.
    await this.ctx.bus.emit('hook:on-scan-complete', {
      agent: this.id,
      ok,
      verdict,
      scan: state.scanCount,
      loopIteration: state.loops.scan
    });
  }
}
