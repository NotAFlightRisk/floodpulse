import { error } from '@sveltejs/kit';
import { findRain } from '#lib/server/data.js';

export async function load({ params }) {
  const gauge = await findRain(params.id);
  if (!gauge) error(404, 'No rain gauge by that name');
  return { gauge };
}
