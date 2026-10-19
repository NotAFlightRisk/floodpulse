import { waitUntil } from 'cloudflare:workers';

const edge = () => (globalThis as { caches?: { default?: Cache } }).caches?.default;

/** Answers from Cloudflare's cache when it can, and keeps a good answer for next time */
export async function cachedFetch(
  request: Request,
  seconds: number,
  load: () => Promise<Response>
) {
  // keyed on the path alone, so a made-up query string can't skip the cache
  const { origin, pathname } = new URL(request.url);
  const key = new Request(origin + pathname);
  const hit = await edge()?.match(key);
  if (hit) return hit;
  const fresh = await load();
  const response = new Response(fresh.body, fresh);
  response.headers.set('cache-control', `public, max-age=${seconds}`);
  if (response.ok) waitUntil(edge()?.put(key, response.clone()) ?? Promise.resolve());
  return response;
}
