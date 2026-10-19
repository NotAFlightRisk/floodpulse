import type { Kind, Mark, RainStation, Severity, Station, Warning } from '#lib/types.js';
import { fromGrid } from './grid.ts';

export const EA = 'https://environment.data.gov.uk/flood-monitoring';

type Raw = Record<string, unknown>;

// the API hands back a list wherever a station has had two of something
const one = <T>(value: T | T[]) => (Array.isArray(value) ? value[0] : value);
const text = (value: unknown) =>
  typeof one(value) === 'string' ? (one(value) as string) : undefined;
const num = (value: unknown) => {
  const first = one(value);
  return typeof first === 'number' && Number.isFinite(first) ? first : undefined;
};
const tail = (uri: unknown) => text(uri)?.split('/').pop() ?? '';
const list = (value: unknown) => (Array.isArray(value) ? value : value ? [value] : []) as Raw[];

export async function get<T = Raw>(path: string, timeout = 30_000): Promise<T> {
  const res = await fetch(`${EA}${path}`, {
    headers: { accept: 'application/json', 'user-agent': 'floodpulse.peng.ly' },
    signal: AbortSignal.timeout(timeout)
  });
  if (!res.ok) throw new Error(`EA answered ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

export const items = async (path: string) => (await get<{ items: Raw[] }>(path)).items;

// best first: the river itself, then the sea, then the ground, then below a weir
const QUALIFIERS: [string, Kind, string][] = [
  ['Stage', 'river', 'stageScale'],
  ['Tidal Level', 'tidal', 'stageScale'],
  ['Groundwater', 'ground', 'stageScale'],
  ['Downstream Stage', 'river', 'downstageScale']
];

const mark = (raw: unknown): Mark | undefined => {
  const value = num((raw as Raw | undefined)?.value);
  const date = text((raw as Raw | undefined)?.dateTime);
  return value === undefined || !date ? undefined : { value, date };
};

// most boreholes only come with a 1 km grid square, so that'll have to do
const place = (raw: Raw) => {
  const [lat, lon] = [num(raw.lat), num(raw.long)];
  const grid = text(raw.gridReference);
  return lat !== undefined && lon !== undefined ? [lat, lon] : grid ? fromGrid(grid) : undefined;
};

export function toStation(raw: Raw): Station | undefined {
  const id = text(raw.notation);
  const [lat, lon] = place(raw) ?? [];
  if (!id || lat === undefined || lon === undefined || tail(raw.status) === 'statusClosed') return;
  const measures = list(raw.measures).filter((m) => text(m.unitName)?.startsWith('m'));
  for (const [qualifier, kind, scaleKey] of QUALIFIERS) {
    const measure = measures.find((m) => text(m.qualifier) === qualifier);
    if (!measure) continue;
    const scale = (typeof raw[scaleKey] === 'object' ? raw[scaleKey] : {}) as Raw;
    const low = num(scale.typicalRangeLow);
    const high = num(scale.typicalRangeHigh);
    const ranged = low !== undefined && high !== undefined && high > low;
    return {
      id,
      name: text(raw.label) ?? id,
      river: text(raw.riverName),
      town: text(raw.town),
      lat,
      lon,
      kind,
      measure: tail(measure['@id']),
      unit: text(measure.unitName)!,
      rloi: text(raw.RLOIid),
      low: ranged ? low : undefined,
      high: ranged ? high : undefined,
      record: mark(scale.maxOnRecord),
      recent: mark(scale.highestRecent)
    };
  }
}

export function toRainStation(raw: Raw): RainStation | undefined {
  const id = text(raw.notation);
  const lat = num(raw.lat);
  const lon = num(raw.long);
  const measure = list(raw.measures).find((m) => text(m.parameter) === 'rainfall');
  if (!id || lat === undefined || lon === undefined || !measure) return;
  return { id, lat, lon, measure: tail(measure['@id']) };
}

/** Newest reading per measure, keyed by the measure's own id */
export function toReadings(raw: Raw[]) {
  const readings = new Map<string, { value: number; at: string }>();
  for (const reading of raw) {
    const value = num(reading.value);
    const at = text(reading.dateTime);
    const measure = tail(reading.measure);
    const known = readings.get(measure);
    if (value === undefined || !at || !measure) continue;
    if (!known || Date.parse(at) > Date.parse(known.at)) readings.set(measure, { value, at });
  }
  return readings;
}

export function toWarning(raw: Raw, areas: Record<string, [number, number]>): Warning | undefined {
  const severity = num(raw.severityLevel);
  const id = text(raw.floodAreaID);
  const raised = text(raw.timeRaised);
  if ((severity !== 1 && severity !== 2 && severity !== 3) || !id || !raised) return;
  const area = (raw.floodArea ?? {}) as Raw;
  const [lat, lon] = areas[id] ?? [];
  return {
    id,
    severity: severity as Severity,
    label: text(raw.description) ?? id,
    area: text(raw.eaAreaName),
    county: text(area.county),
    water: text(area.riverOrSea),
    message: text(raw.message)?.trim() || undefined,
    raised,
    changed: text(raw.timeSeverityChanged),
    lat,
    lon
  };
}

export function toAreas(raw: Raw[]) {
  const areas: Record<string, [number, number]> = {};
  for (const area of raw) {
    const code = text(area.notation);
    const lat = num(area.lat);
    const lon = num(area.long);
    if (code && lat !== undefined && lon !== undefined) areas[code] = [lat, lon];
  }
  return areas;
}
