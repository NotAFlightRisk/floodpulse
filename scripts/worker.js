import app from '../.svelte-kit/cloudflare/_worker.js';

// SvelteKit has no cron handler, so the cron knocks on the front door like everyone else
export default {
  ...app,
  scheduled(controller, env, ctx) {
    const request = new Request(`${env.ORIGIN}/api/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' }
    });
    ctx.waitUntil(app.fetch(request, env, ctx));
  }
};
