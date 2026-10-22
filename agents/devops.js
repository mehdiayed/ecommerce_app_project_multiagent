import { Agent } from './_base.js';

export class DevOpsAgent extends Agent {
  constructor(ctx) {
    super(ctx, 'devops');
  }

  /** agent:devops:deploy — final step; success fires hook:on-pipeline-success. */
  async deploy() {
    await this.setStatus('on execution', 'rendering Helm/K8s manifests and deploying');
    const ok = await this.work('devops');
    if (!ok) {
      await this.setStatus('blocked', 'deployment failed');
      return this.ctx.agents.orchestrator.fail('Deployment failed');
    }
    await this.setStatus('done', 'deployed');
    await this.ctx.bus.emit('hook:on-pipeline-success', { agent: this.id });
  }
}
