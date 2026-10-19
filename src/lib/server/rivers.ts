import data from '#lib/data/rivers.json';
import { stale } from '#lib/format.js';
import type { Gauge, River, RiverName } from '#lib/types.js';

interface Entry {
  slug: string;
  name: string;
  length: number;
  bounds: number[];
  into?: number[];
  sea?: boolean;
  gauges: [string, number][];
}

const entries = data.rivers as Entry[];
const bySlug = new Map(entries.map((entry, i) => [entry.slug, i]));
const byGauge = new Map(entries.flatMap((entry, i) => entry.gauges.map(([id]) => [id, i])));

/** Where the river network's tiles live for this build, and the box they cover */
export const tiles = { url: data.tiles, bounds: data.bounds as River['bounds'] };

function river(index: number): River {
  const { slug, name, length, bounds, into, sea, gauges } = entries[index];
  const joins = into && entries[into[0]];
  return {
    index,
    slug,
    name,
    length,
    bounds: bounds as River['bounds'],
    into: joins && { slug: joins.slug, name: joins.name, km: into[1] },
    sea,
    stops: gauges.map(([id, km]) => ({ id, km }))
  };
}

const found = (index?: number) => (index === undefined ? undefined : river(index));

export const riverBySlug = (slug: string) => found(bySlug.get(slug));
export const riverOf = (gauge: string) => found(byGauge.get(gauge));

/** Every river, biggest first, with what it flows into for telling two Avons apart */
export const riverNames = (): RiverName[] =>
  entries.map(({ slug, name, gauges, into }) => ({
    slug,
    name,
    gauges: gauges.length,
    into: into && entries[into[0]].name
  }));

/** The rivers with the most gauges above normal, then the most rising, then the longest */
export function busiest(gauges: Gauge[], count = 6) {
  const byId = new Map(gauges.map((gauge) => [gauge.id, gauge]));
  const scored = entries.map((entry, index) => {
    const live = entry.gauges.map(([id]) => byId.get(id)).filter((g) => g && !stale(g.at));
    return {
      index,
      high: live.filter((g) => g!.state === 'high').length,
      rising: live.filter((g) => g!.trend === 'rising').length
    };
  });
  return scored
    .sort((a, b) => b.high - a.high || b.rising - a.rising || a.index - b.index)
    .slice(0, count)
    .map(({ index }) => river(index));
}
