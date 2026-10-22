/** hook:on-code-rejected — Loop 1: Code Scan said KO, Migration fixes and re-submits until OK. */
export default async function onCodeRejected(ctx, { scan, loopIteration }) {
  if (loopIteration >= ctx.config.maxScanIterations) {
    return ctx.agents.orchestrator.fail(`Code scan still KO after ${loopIteration} iterations`);
  }
  await ctx.agents.migration.run({ reason: 'scan-rejected', feedback: `scan #${scan} KO` });
}
