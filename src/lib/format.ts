import type { Kind, Severity, State, Trend } from './types.ts';

const ZONE = 'Europe/London';
const dates = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: ZONE
});
const clocks = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: ZONE
});
const days = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: ZONE });

// the EA's record dates come without a zone, and they're UTC
const parse = (iso: string) => Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);

export const metres = (value: number) => `${value.toFixed(2)} m`;
export const signed = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '-' : ''}${metres(Math.abs(value))}`;
export const millimetres = (value: number) => `${value.toFixed(1)} mm`;
export const date = (iso: string) => dates.format(parse(iso));
export const clock = (iso: string | number) =>
  clocks.format(typeof iso === 'number' ? iso : parse(iso));
export const weekday = (time: number) => days.format(time);

export function ago(iso: string, now = Date.now()) {
  const mins = Math.round((now - parse(iso)) / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** A reading over two hours old is the gauge going quiet, not the river standing still */
export const stale = (iso: string | undefined, now = Date.now()) =>
  !iso || now - parse(iso) > 2 * 60 * 60_000;

export const datum = (unit: string) =>
  ({
    mAOD: 'above sea level (Ordnance Datum)',
    mASD: "above the gauge's own zero",
    mBDAT: 'below the borehole datum'
  })[unit] ?? "on the gauge's own scale";

export const trendLabel: Record<Trend, string> = {
  rising: 'Rising',
  falling: 'Falling',
  steady: 'Steady',
  unknown: 'No trend yet'
};

export const stateLabel: Record<State, string> = {
  high: 'Above normal',
  normal: 'Normal',
  low: 'Below normal',
  unknown: 'No normal range'
};

export const kindLabel: Record<Kind, string> = {
  river: 'River',
  tidal: 'Tidal',
  ground: 'Groundwater'
};

export const severityLabel: Record<Severity, string> = {
  1: 'Severe flood warning',
  2: 'Flood warning',
  3: 'Flood alert'
};
