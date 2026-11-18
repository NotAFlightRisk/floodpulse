import { describe, expect, it } from 'vitest';
import { busiest, riverBySlug } from '../../../src/lib/server/rivers.ts';
import type { Gauge } from '../../../src/lib/types.ts';

const high = (id: string): Gauge => ({
  id,
  name: id,
  lat: 51.6,
  lon: -3,
  kind: 'river',
  measure: `${id}-level`,
  unit: 'm',
  value: 2,
  at: new Date().toISOString(),
  trend: 'steady',
  state: 'high'
});

describe('busiest', () => {
  it('leaves out the stops the snapshot has no gauge for', () => {
    const [first, , ...rest] = riverBySlug('ebwy')!.stops.map((stop) => stop.id);
    const [top] = busiest([first, ...rest].map(high), 1);
    expect(top.slug).toBe('ebwy');
    expect(top.stops.map((stop) => stop.id)).toEqual([first, ...rest]);
  });
});
