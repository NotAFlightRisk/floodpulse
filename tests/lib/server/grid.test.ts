import { describe, expect, it } from 'vitest';
import { fromGrid } from '../../../src/lib/server/grid.ts';

describe('fromGrid', () => {
  // the EA publishes both for most river gauges, so they make a handy answer sheet
  it.each([
    ['TQ3328828283', 51.038451, -0.100268],
    ['SW 46760 28560', 50.10302, -5.54277],
    ['SO4318882677', 52.439087, -2.837158]
  ])('puts %s where the EA does, to within a few metres', (reference, lat, lon) => {
    const [gotLat, gotLon] = fromGrid(reference)!;
    expect(gotLat).toBeCloseTo(lat, 4);
    expect(gotLon).toBeCloseTo(lon, 4);
  });

  it('refuses references it cannot read', () => {
    expect(fromGrid('TQ391')).toBeUndefined();
    expect(fromGrid('IQ3910')).toBeUndefined();
    expect(fromGrid('nope')).toBeUndefined();
    expect(fromGrid('ZZ0000')).toBeUndefined();
  });
});
