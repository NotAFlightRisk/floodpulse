import { error } from '@sveltejs/kit';
import { findGauge } from '#lib/server/data.js';

export async function load({ params }) {
  const gauge = await findGauge(params.id);
  if (!gauge) error(404, 'No gauge by that name');
  return { gauge };
}
