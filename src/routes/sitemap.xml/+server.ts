import { liveBody } from '#lib/server/data.js';
import { site } from '#lib/meta.js';
import type { Live } from '#lib/types.js';

export async function GET() {
  const { gauges }: Live = JSON.parse((await liveBody()) ?? '{"gauges":[]}');
  const pages = ['/', ...gauges.map((gauge) => `/station/${gauge.id}`)];
  const urls = pages.map((path) => `<url><loc>${site}${path}</loc></url>`).join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`,
    { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=86400' } }
  );
}
