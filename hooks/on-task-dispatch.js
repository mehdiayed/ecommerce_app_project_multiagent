/** hook:on-task-dispatch — Step 0: a task was dispatched, start Monitoring (agent:monitor:watch). */
export default async function onTaskDispatch(ctx) {
  await ctx.agents.monitoring.watch();
}
