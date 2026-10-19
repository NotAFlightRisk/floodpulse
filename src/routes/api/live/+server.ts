import { liveBody } from '#lib/server/data.js';

export async function GET() {
  return new Response(await liveBody(), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' }
  });
}
