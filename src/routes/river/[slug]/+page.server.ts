import { error } from '@sveltejs/kit';
import { gaugesOn } from '#lib/server/data.js';
import { riverBySlug } from '#lib/server/rivers.js';

export async function load({ params }) {
  const river = riverBySlug(params.slug);
  const found = river && (await gaugesOn(river));
  if (!found?.gauges.length) error(404, 'No river by that name, or none with a gauge on it');
  return found;
}
