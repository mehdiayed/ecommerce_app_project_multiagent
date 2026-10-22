import { spawnSync } from 'node:child_process';

export const STATUSES = ['on execution', 'on hold', 'done', 'blocked', 'waiting'];

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Agent {
  constructor(ctx, id) {
    this.ctx = ctx;
    this.id = id;
  }

  get label() {
    return this.ctx.agentsConfig[this.id].label;
  }

  /** Every status change goes through hook:status-update so Monitoring sees it. */
  async setStatus(status, detail = '') {
    if (!STATUSES.includes(status)) throw new Error(`Unknown status: ${status}`);
    await this.ctx.bus.emit('hook:status-update', { agent: this.id, status, detail });
  }

  emit(type, payload = {}) {
    return this.ctx.bus.emit(type, { agent: this.id, ...payload });
  }

  /**
   * Runs one unit of work. In simulate mode it only waits and returns `simulatedOk`;
   * in real mode it executes the configured shell command and returns its success.
   */
  async work(commandKey, simulatedOk = true) {
    const { mode, simulate, real } = this.ctx.config;
    if (mode !== 'real') {
      await sleep(simulate.delayMs);
      return simulatedOk;
    }
    const command = real.commands[commandKey];
    const result = spawnSync(command, { cwd: this.ctx.root, shell: true, encoding: 'utf8' });
    await this.emit('command:executed', {
      command,
      exitCode: result.status,
      output: `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-2000)
    });
    return result.status === 0;
  }
}
