import { refresh } from '#lib/server/refresh.js';

// public, but it won't fetch anything the cron isn't about to fetch anyway
export async function POST() {
  await refresh();
  return new Response(null, { status: 204 });
}
