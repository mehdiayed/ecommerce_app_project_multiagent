/**
 * hook:on-scan-complete — Loop 1 router.
 * OK → Orchestrator releases QA (loop 2). KO → hook:on-code-rejected sends Migration back to work.
 */
export default async function onScanComplete(ctx, { ok, verdict, scan }) {
  await ctx.agents.orchestrator.emit('scan:verdict', { verdict, scan });
  if (ok) {
    await ctx.agents.orchestrator.setStatus('on execution', 'scan OK — launching QA');
    await ctx.agents.qa.run();
  } else {
    await ctx.bus.emit('hook:on-code-rejected', { scan, loopIteration: ctx.state.loops.scan });
  }
}
