/** hook:status-update — every agent status change lands in the Monitoring matrix. */
export default async function onStatusUpdate(ctx, payload) {
  ctx.agents.monitoring.record(payload);
}
