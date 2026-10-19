import { describe, expect, it } from 'vitest';
import { fromGrid } from '../../../src/lib/server/grid.ts';

describe('fromGrid', () => {
  it('agrees with the EA, which publishes both for most river gauges', () => {
    // Ardingly (E8266) is TQ3328828283 at 51.038451, -0.100268 on WGS84
    const [lat, lon] = fromGrid('TQ3328828283')!;
    expect(lat).toBeCloseTo(51.03845, 2);
    expect(lon).toBeCloseTo(-0.10027, 2);
  });

  it("finds the OS's own worked example to within a hundred metres", () => {
    // TG 51401 13177 is 52 39 27.2531 N, 1 43 4.5177 E on OSGB36
    const [lat, lon] = fromGrid('TG5140113177')!;
    expect(lat).toBeCloseTo(52.65757, 3);
    expect(lon).toBeCloseTo(1.71792, 3);
  });

  it('refuses references it cannot read', () => {
    expect(fromGrid('TQ391')).toBeUndefined();
    expect(fromGrid('IQ3910')).toBeUndefined();
    expect(fromGrid('nope')).toBeUndefined();
    expect(fromGrid('ZZ0000')).toBeUndefined();
  });
});
