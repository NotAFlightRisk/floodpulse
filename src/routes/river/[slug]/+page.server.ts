import { error } from '@sveltejs/kit';
import { gaugesOn } from '#lib/server/data.js';
import { riverBySlug } from '#lib/server/rivers.js';

export async function load({ params }) {
  const river = riverBySlug(params.slug);
  if (!river) error(404, 'No river by that name, or none with a gauge on it');
  return { river, gauges: await gaugesOn(river) };
}
