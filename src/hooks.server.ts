import type { HandleServerError, ServerInit } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { env, waitUntil } from 'cloudflare:workers';
import { refresh } from '#lib/server/refresh.js';
import { report } from '#lib/server/report.js';

const EVERY = 15 * 60_000;

// Cloudflare has a cron for this, a Node server keeps its own time
export const init: ServerInit = () => {
  if (env.STORE || building) return;
  const tick = () => refresh().catch((err) => report(err));
  tick();
  setInterval(tick, EVERY);
};

export const handleError: HandleServerError = ({ kind, error, event }) => {
  if (kind !== 'unknown') return;
  waitUntil(report(error, event));
};
