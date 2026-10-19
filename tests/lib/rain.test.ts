import { describe, expect, it } from 'vitest';
import { hourly, total } from '../../src/lib/rain.ts';
import type { Point } from '../../src/lib/types.ts';

const now = Date.parse('2026-10-19T10:40:00Z');
const at = (iso: string) => Date.parse(iso) / 60_000;

describe('hourly', () => {
  it('puts a reading on the hour into the hour it closes', () => {
    const points: Point[] = [
      [at('2026-10-19T10:00:00Z'), 0.4],
      [at('2026-10-19T10:15:00Z'), 0.2],
      [at('2026-10-19T09:15:00Z'), 0.1]
    ];
    const hours = hourly(points, now, 3);
    expect(hours.map((hour) => hour.mm)).toEqual([0, 0.5, 0.2]);
    expect(hours[2].at).toBe(at('2026-10-19T10:00:00Z'));
  });

  it('leaves out readings older than the window', () => {
    expect(hourly([[at('2026-10-19T08:00:00Z'), 3]], now, 2).every((hour) => hour.mm === 0)).toBe(
      true
    );
  });
});

describe('total', () => {
  it('adds up everything newer than the cut-off', () => {
    const points: Point[] = [
      [at('2026-10-19T09:30:00Z'), 1],
      [at('2026-10-19T10:30:00Z'), 0.5]
    ];
    expect(total(points, now, 60)).toBe(0.5);
    expect(total(points, now, 120)).toBe(1.5);
  });
});
