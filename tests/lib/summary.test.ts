import { describe, expect, it } from 'vitest';
import { summarise } from '../../src/lib/summary.ts';
import type { Gauge } from '../../src/lib/types.ts';

const gauge = (id: string, extra: Partial<Gauge>): Gauge => ({
  id,
  name: id,
  lat: 52,
  lon: -1,
  kind: 'river',
  measure: `${id}-level`,
  unit: 'm',
  value: 1,
  trend: 'steady',
  state: 'normal',
  ...extra
});

describe('summarise', () => {
  it('counts rivers only, and ranks the risers by how far they went', () => {
    const summary = summarise({
      fetchedAt: '2026-10-19T15:00:00Z',
      rain: [],
      warnings: [],
      gauges: [
        gauge('slow', { trend: 'rising', change: 0.05, state: 'high' }),
        gauge('fast', { trend: 'rising', change: 0.4 }),
        gauge('sea', { kind: 'tidal', trend: 'rising', change: 1.2, state: 'high' }),
        gauge('quiet', { value: undefined, trend: 'unknown', state: 'unknown' })
      ]
    });
    expect(summary).toMatchObject({ rivers: 2, high: 1, rising: 2, tracked: 2 });
    expect(summary.risers.map((g) => g.id)).toEqual(['fast', 'slow']);
  });
});
