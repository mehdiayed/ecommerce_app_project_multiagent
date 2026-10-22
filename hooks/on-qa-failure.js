/**
 * hook:on-qa-failure — Loop 2: QA failed, go back upstream to Migration.
 * The scan loop counter is reset because Migration → Code Scan (loop 1) restarts.
 */
export default async function onQaFailure(ctx, { failures, run }) {
  if (ctx.state.loops.qa >= ctx.config.maxQaIterations) {
    return ctx.agents.orchestrator.fail(`QA still failing after ${run} runs (${failures.join(', ')})`);
  }
  ctx.state.loops.scan = 0;
  await ctx.agents.migration.run({ reason: 'qa-failure', feedback: failures.join(', ') });
}
