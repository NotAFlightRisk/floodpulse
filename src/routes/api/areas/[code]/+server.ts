import { error } from '@sveltejs/kit';
import { EA } from '#lib/server/ea.js';
import { cachedFetch } from '#lib/server/edge.js';

const CODE = /^\w+$/;

export async function GET({ params, request }) {
  if (!CODE.test(params.code)) error(404, 'No such area');
  return cachedFetch(request, 86_400, async () => {
    const res = await fetch(`${EA}/id/floodAreas/${params.code}/polygon`, {
      signal: AbortSignal.timeout(30_000)
    });
    if (!res.ok) error(res.status === 404 ? 404 : 502, 'No outline for that area');
    return new Response(res.body, { headers: { 'content-type': 'application/geo+json' } });
  });
}
