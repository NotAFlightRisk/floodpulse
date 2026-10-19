import type { Gauge, Live, Summary } from './types.ts';

const RISERS = 8;

/** The headline numbers, rivers only, since tides and boreholes play by other rules */
export function summarise({ fetchedAt, gauges, warnings }: Live): Summary {
  const rivers = gauges.filter((gauge) => gauge.kind === 'river' && gauge.value !== undefined);
  const count = (test: (gauge: Gauge) => boolean) => rivers.filter(test).length;
  return {
    fetchedAt,
    rivers: rivers.length,
    high: count((gauge) => gauge.state === 'high'),
    low: count((gauge) => gauge.state === 'low'),
    rising: count((gauge) => gauge.trend === 'rising'),
    falling: count((gauge) => gauge.trend === 'falling'),
    tracked: count((gauge) => gauge.trend !== 'unknown'),
    warnings,
    risers: rivers
      .filter((gauge) => gauge.trend === 'rising')
      .sort((a, b) => b.change! - a.change!)
      .slice(0, RISERS)
  };
}
