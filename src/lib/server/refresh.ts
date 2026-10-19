import type { Live, RainStation, Station, Summary } from '#lib/types.js';
import { items, toAreas, toRainStation, toReadings, toStation, toWarning } from './ea.ts';
import { summarise } from '#lib/summary.js';
import { readGauges, type Trail } from './levels.ts';
import { report } from './report.ts';
import { readJson, write } from './store.ts';

interface Catalogue {
  builtAt: string;
  stations: Station[];
  rain: RainStation[];
  areas: Record<string, [number, number]>;
}

const DAY = 24 * 60 * 60_000;
// the EA updates every 15 minutes, so anything sooner is just asking twice
const QUIET = 5 * 60_000;

const age = (iso?: string) => (iso ? Date.now() - Date.parse(iso) : Infinity);
const defined = <T>(value: T | undefined): value is T => value !== undefined;
const renamed = (reading?: { value: number; at: string }) =>
  reading && { mm: reading.value, at: reading.at };

async function buildCatalogue(): Promise<Catalogue> {
  const [levels, rain, areas] = await Promise.all([
    items('/id/stations?parameter=level&_view=full&_limit=10000'),
    items('/id/stations?parameter=rainfall&_limit=10000'),
    items('/id/floodAreas?_limit=10000')
  ]);
  return {
    builtAt: new Date().toISOString(),
    stations: levels.map(toStation).filter(defined),
    rain: rain.map(toRainStation).filter(defined),
    areas: toAreas(areas)
  };
}

// stations barely change, so a day-old list beats no list when the EA is down
async function catalogue() {
  const known = await readJson<Catalogue>('catalogue');
  if (known && age(known.builtAt) < DAY) return known;
  try {
    const fresh = await buildCatalogue();
    await write('catalogue', fresh);
    return fresh;
  } catch (err) {
    if (!known) throw err;
    await report(err);
    return known;
  }
}

async function update() {
  const summary = await readJson<Summary>('summary');
  if (age(summary?.fetchedAt) < QUIET) return;
  const { stations, rain, areas } = await catalogue();
  const [readings, floods, trail] = await Promise.all([
    items('/data/readings?latest'),
    items('/id/floods'),
    readJson<Trail>('trail')
  ]);
  const latest = toReadings(readings);
  const read = readGauges(stations, latest, trail ?? {});
  const live: Live = {
    fetchedAt: new Date().toISOString(),
    gauges: read.gauges,
    rain: rain.map((station) => ({ ...station, ...renamed(latest.get(station.measure)) })),
    warnings: floods
      .map((flood) => toWarning(flood, areas))
      .filter(defined)
      .sort((a, b) => a.severity - b.severity)
  };
  await Promise.all([
    write('live', live),
    write('trail', read.trail),
    write('summary', summarise(live))
  ]);
}

let running: Promise<void> | undefined;

/** Fetches a fresh snapshot unless one landed in the last few minutes, once at a time */
export function refresh() {
  running ??= update().finally(() => (running = undefined));
  return running;
}
