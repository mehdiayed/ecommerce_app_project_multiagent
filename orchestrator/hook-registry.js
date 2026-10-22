import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Binds every `hook:*` declared in config/agents.json to its module in /hooks.
 * A hook module default-exports `async (ctx, payload) => void`.
 */
export async function registerHooks(ctx) {
  for (const [agentId, def] of Object.entries(ctx.agentsConfig)) {
    for (const [event, file] of Object.entries(def.hooks ?? {})) {
      const mod = await import(pathToFileURL(join(ctx.root, file)).href);
      ctx.bus.on(event, (payload) => mod.default(ctx, payload));
      ctx.hooks.push({ agent: agentId, event, file });
    }
  }
}
