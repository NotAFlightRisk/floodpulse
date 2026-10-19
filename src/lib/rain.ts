import type { Point } from './types.ts';

const HOUR = 60;

/** Adds rain readings up into the hours they fell in, each reading closing its own 15 minutes */
export function hourly(points: Point[], now: number, hours = 24) {
  const end = Math.ceil(now / 60_000 / HOUR) * HOUR;
  const totals = Array.from({ length: hours }, (_, i) => ({ at: end - (hours - i) * HOUR, mm: 0 }));
  for (const [at, mm] of points) {
    const slot = hours - 1 - Math.floor((end - at) / HOUR);
    if (slot >= 0 && slot < hours) totals[slot].mm += mm;
  }
  return totals;
}

export const total = (points: Point[], now: number, minutes: number) =>
  points.filter(([at]) => at > now / 60_000 - minutes).reduce((sum, [, mm]) => sum + mm, 0);
