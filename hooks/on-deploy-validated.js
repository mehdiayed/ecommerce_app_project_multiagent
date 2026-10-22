/** hook:on-deploy-validated — deployment is 100% OK: the Docs & Sync agent updates docs and publishes them. */
export default async function onDeployValidated(ctx) {
  await ctx.agents.docs.sync();
}
