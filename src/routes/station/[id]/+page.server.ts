import { error } from '@sveltejs/kit';
import { findGauge, gaugesOn } from '#lib/server/data.js';
import { riverOf } from '#lib/server/rivers.js';

export async function load({ params }) {
  const gauge = await findGauge(params.id);
  if (!gauge) error(404, 'No gauge by that name');
  const river = riverOf(gauge.id);
  return { gauge, river, gauges: river ? await gaugesOn(river) : [] };
}
