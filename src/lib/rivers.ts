import { stale } from './format.ts';
import type { Gauge, RiverName, State, Stop } from './types.ts';

/** Where a reading sits in its gauge's normal range, 0 at the bottom and 1 at the top */
export const position = (gauge: Gauge, now?: number) =>
  gauge.value === undefined ||
  gauge.low === undefined ||
  gauge.high === undefined ||
  stale(gauge.at, now)
    ? undefined
    : (gauge.value - gauge.low) / (gauge.high - gauge.low);

/** A gauge's state, unless it's gone quiet, when it's anyone's guess */
export const current = (gauge: Gauge | undefined, now?: number): State =>
  !gauge || stale(gauge.at, now) ? 'unknown' : gauge.state;

/** The nearest gauge either way along the river, skipping any twin at the same spot */
export function neighbours(stops: Stop[], id: string) {
  const here = stops.find((stop) => stop.id === id);
  if (!here) return {};
  return {
    up: stops.findLast((stop) => stop.km < here.km),
    down: stops.find((stop) => stop.km > here.km)
  };
}

let names: Promise<RiverName[]> | undefined;

/** Every river's name and page, fetched once and only when something needs it */
export function riverNames() {
  names ??= fetch('/api/rivers')
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`rivers ${res.status}`))))
    .catch((err) => {
      names = undefined;
      throw err;
    });
  return names;
}
