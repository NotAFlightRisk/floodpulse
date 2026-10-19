import type { Gauge, Point, State, Station, Trend } from '#lib/types.js';

export type Trail = Record<string, Point[]>;

// a river can sit a centimetre either side of itself all day, so smaller than this is noise
export const STEADY = 0.03;
const WINDOW = 180;
const SLACK = 45;
const KEEP = WINDOW + SLACK + 30;

export const minutes = (iso: string) => Math.round(Date.parse(iso) / 60_000);

/** Adds the latest reading to a measure's trail and drops what's too old to matter */
export function extend(points: Point[] = [], latest: Point): Point[] {
  const kept = points.filter(([at]) => at !== latest[0] && at > latest[0] - KEEP);
  return [...kept, latest].sort((a, b) => a[0] - b[0]);
}

/** How far the level has moved over about three hours, if we saw it three hours ago */
export function change(points: Point[], latest: Point) {
  let best: Point | undefined;
  for (const point of points) {
    const off = Math.abs(latest[0] - WINDOW - point[0]);
    if (off <= SLACK && (!best || off < Math.abs(latest[0] - WINDOW - best[0]))) best = point;
  }
  return best && Math.round((latest[1] - best[1]) * 1000) / 1000;
}

export function trendOf(delta: number | undefined): Trend {
  if (delta === undefined) return 'unknown';
  if (delta > STEADY) return 'rising';
  if (delta < -STEADY) return 'falling';
  return 'steady';
}

export function stateOf({ low, high }: Station, value: number | undefined): State {
  if (value === undefined || low === undefined || high === undefined) return 'unknown';
  if (value > high) return 'high';
  if (value < low) return 'low';
  return 'normal';
}

// a gauge that's gone quiet this long has no business saying which way it's heading
const QUIET = 120;

/** Joins the catalogue to the latest readings, moving each measure's trail along as it goes */
export function readGauges(
  stations: Station[],
  readings: Map<string, { value: number; at: string }>,
  trail: Trail,
  now = Date.now()
) {
  const next: Trail = {};
  const gauges = stations.map((station): Gauge => {
    const reading = readings.get(station.measure);
    const points = reading
      ? extend(trail[station.measure], [minutes(reading.at), reading.value])
      : trail[station.measure];
    if (!points?.length) return { ...station, trend: 'unknown', state: 'unknown' };
    next[station.measure] = points;
    // the newest we've ever seen, in case the EA hands back an older one
    const latest = points.at(-1)!;
    const delta = now / 60_000 - latest[0] > QUIET ? undefined : change(points, latest);
    return {
      ...station,
      value: latest[1],
      at: new Date(latest[0] * 60_000).toISOString(),
      change: delta,
      trend: trendOf(delta),
      state: stateOf(station, latest[1])
    };
  });
  return { gauges, trail: next };
}
