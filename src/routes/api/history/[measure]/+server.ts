import { error, json } from '@sveltejs/kit';
import { get } from '#lib/server/ea.js';
import { cachedFetch } from '#lib/server/edge.js';
import { minutes } from '#lib/server/levels.js';
import type { Point } from '#lib/types.js';

const DAYS = 5;
const MEASURE = /^[\w.-]+-(level|rainfall)-[\w.-]+$/;

export async function GET({ params, request }) {
  if (!MEASURE.test(params.measure)) error(404, 'No such measure');
  return cachedFetch(request, 300, async () => {
    const since = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 19) + 'Z';
    const { items } = await get<{ items: { dateTime: string; value: unknown }[] }>(
      `/id/measures/${params.measure}/readings?since=${since}&_sorted&_limit=2000`
    );
    const points = items
      .filter((item) => typeof item.value === 'number')
      .map((item): Point => [minutes(item.dateTime), item.value as number])
      .reverse();
    return json(points);
  });
}
