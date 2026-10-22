/**
 * hook:on-pipeline-success — DevOps finished. Triggers hook:on-deploy-validated (Docs & Sync),
 * and only then closes the mission with Monitoring and writes logs/report.md.
 */
export default async function onPipelineSuccess(ctx) {
  ctx.state.outcome = 'success';
  await ctx.bus.emit('hook:on-deploy-validated', { agent: 'devops' });
  await ctx.agents.orchestrator.setStatus('done', 'mission complete');
  const docsNote = ctx.state.docsFailed ? ' (docs sync failed — see events.jsonl)' : '';
  await ctx.agents.monitoring.close('success', `all loops validated, deployed and documented${docsNote}`);
}
