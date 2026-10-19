import { describe, expect, it } from 'vitest';
import { change, extend, readGauges, stateOf, trendOf } from '../../../src/lib/server/levels.ts';
import type { Point, Station } from '../../../src/lib/types.ts';

const station: Station = {
  id: 'X1',
  name: 'Somewhere',
  lat: 52,
  lon: -1,
  kind: 'river',
  measure: 'X1-level-stage-i-15_min-m',
  unit: 'm',
  low: 0.2,
  high: 1.4
};

describe('extend', () => {
  it('keeps one point per time and forgets anything over four hours old', () => {
    const points = extend(
      [
        [1000, 1],
        [1200, 2]
      ],
      [1300, 3]
    );
    expect(points).toEqual([
      [1200, 2],
      [1300, 3]
    ]);
    expect(extend(points, [1300, 3])).toEqual(points);
  });
});

describe('change', () => {
  const latest: Point = [2000, 1.5];

  it('compares with the reading nearest three hours earlier', () => {
    const points: Point[] = [[1790, 1.0], [1815, 1.2], [1900, 1.4], latest];
    expect(change(points, latest)).toBe(0.3);
  });

  it("gives up when nothing's close enough to three hours ago", () => {
    expect(change([[1900, 1.4], latest], latest)).toBeUndefined();
  });
});

describe('trendOf', () => {
  it('calls anything inside 3cm steady', () => {
    expect(trendOf(0.03)).toBe('steady');
    expect(trendOf(-0.031)).toBe('falling');
    expect(trendOf(0.05)).toBe('rising');
    expect(trendOf(undefined)).toBe('unknown');
  });
});

describe('stateOf', () => {
  it('reads a level against its own typical range', () => {
    expect(stateOf(station, 1.5)).toBe('high');
    expect(stateOf(station, 0.1)).toBe('low');
    expect(stateOf(station, 1.4)).toBe('normal');
    expect(stateOf({ ...station, low: undefined }, 5)).toBe('unknown');
  });
});

describe('readGauges', () => {
  const at = '2026-10-19T15:00:00Z';
  const now = Date.parse(at) / 60_000;

  it('works out a trend from the trail and moves the trail along', () => {
    const readings = new Map([[station.measure, { value: 1.6, at }]]);
    const { gauges, trail } = readGauges(
      [station],
      readings,
      { [station.measure]: [[now - 180, 1.2]] },
      Date.parse(at)
    );
    expect(gauges[0]).toMatchObject({ value: 1.6, change: 0.4, trend: 'rising', state: 'high' });
    expect(trail[station.measure]).toEqual([
      [now - 180, 1.2],
      [now, 1.6]
    ]);
  });

  it('keeps the newest reading when the EA hands back an older one', () => {
    const readings = new Map([[station.measure, { value: 1.0, at: '2026-10-19T14:45:00Z' }]]);
    const { gauges } = readGauges(
      [station],
      readings,
      {
        [station.measure]: [
          [now - 180, 1.2],
          [now, 1.6]
        ]
      },
      Date.parse(at)
    );
    expect(gauges[0]).toMatchObject({
      value: 1.6,
      at: '2026-10-19T15:00:00.000Z',
      trend: 'rising'
    });
  });

  it('stops calling a trend once the gauge has gone quiet', () => {
    const readings = new Map([[station.measure, { value: 1.6, at }]]);
    const later = Date.parse(at) + 3 * 3_600_000;
    const { gauges } = readGauges(
      [station],
      readings,
      { [station.measure]: [[now - 180, 1.2]] },
      later
    );
    expect(gauges[0]).toMatchObject({ value: 1.6, trend: 'unknown', state: 'high' });
  });

  it('falls back on the trail when a gauge misses a reading, and knows nothing without one', () => {
    const kept = { [station.measure]: [[now, 1] as Point] };
    const { gauges, trail } = readGauges(
      [station, { ...station, id: 'X2', measure: 'none' }],
      new Map(),
      kept,
      Date.parse(at)
    );
    expect(gauges[0]).toMatchObject({ value: 1, state: 'normal' });
    expect(gauges[1]).toMatchObject({ trend: 'unknown', state: 'unknown' });
    expect(gauges[1].value).toBeUndefined();
    expect(trail).toEqual(kept);
  });
});
