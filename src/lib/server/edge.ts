import { waitUntil } from 'cloudflare:workers';

const edge = () => (globalThis as { caches?: { default?: Cache } }).caches?.default;

/** Answers from Cloudflare's cache when it can, and keeps a good answer for next time */
export async function cachedFetch(
  request: Request,
  seconds: number,
  load: () => Promise<Response>
) {
  const key = new Request(request.url);
  const hit = await edge()?.match(key);
  if (hit) return hit;
  const fresh = await load();
  const response = new Response(fresh.body, fresh);
  response.headers.set('cache-control', `public, max-age=${seconds}`);
  if (response.ok) waitUntil(edge()?.put(key, response.clone()) ?? Promise.resolve());
  return response;
}
