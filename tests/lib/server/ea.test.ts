import { describe, expect, it } from 'vitest';
import { toReadings, toStation, toWarning } from '../../../src/lib/server/ea.ts';

const base = 'http://environment.data.gov.uk/flood-monitoring/id';
const measure = (qualifier: string, unitName = 'mASD', id = qualifier.toLowerCase()) => ({
  '@id': `${base}/measures/S1-level-${id}-i-15_min-${unitName}`,
  parameter: 'level',
  qualifier,
  unitName
});
const raw = {
  notation: 'S1',
  label: ['Bourton Dickler', 'Bourton Dickler TL'],
  riverName: 'River Dikler',
  lat: [51.87, 51.88],
  long: -1.74,
  status: `${base}/def/core/statusActive`,
  measures: [measure('Downstream Stage', 'mASD', 'downstage'), measure('Stage')],
  stageScale: {
    typicalRangeLow: 0.068,
    typicalRangeHigh: 0.42,
    maxOnRecord: { dateTime: '2007-07-20T20:00:00', value: 0.82 }
  },
  downstageScale: { typicalRangeLow: -0.5, typicalRangeHigh: 0.1 }
};

describe('toStation', () => {
  it('picks the stage measure over the one below the weir, with its own range', () => {
    expect(toStation(raw)).toMatchObject({
      id: 'S1',
      name: 'Bourton Dickler',
      lat: 51.87,
      kind: 'river',
      measure: 'S1-level-stage-i-15_min-mASD',
      low: 0.068,
      high: 0.42,
      record: { value: 0.82, date: '2007-07-20T20:00:00' }
    });
  });

  it('falls back to the downstream measure and its downstage scale', () => {
    const station = toStation({
      ...raw,
      measures: [measure('Downstream Stage', 'mASD', 'downstage')]
    });
    expect(station).toMatchObject({ low: -0.5, high: 0.1, kind: 'river' });
  });

  it("skips closed stations, missing ids or coordinates, and measures that aren't in metres", () => {
    expect(toStation({ ...raw, status: `${base}/def/core/statusClosed` })).toBeUndefined();
    expect(toStation({ ...raw, lat: undefined })).toBeUndefined();
    expect(toStation({ ...raw, notation: '' })).toBeUndefined();
    expect(toStation({ ...raw, measures: measure('Stage', 'V') })).toBeUndefined();
  });

  it('ignores a scale that is only a link, and a range that runs backwards', () => {
    expect(
      toStation({ ...raw, stageScale: `${base}/stations/S1/stageScale` })?.low
    ).toBeUndefined();
    const backwards = { typicalRangeLow: 1, typicalRangeHigh: 0.5 };
    expect(toStation({ ...raw, stageScale: backwards })?.high).toBeUndefined();
  });
});

describe('toReadings', () => {
  it('keeps the newest of two readings for one measure', () => {
    const readings = toReadings([
      { measure: `${base}/measures/A-level`, dateTime: '2026-10-19T14:15:00Z', value: 1.3 },
      { measure: `${base}/measures/A-level`, dateTime: '2026-10-19T14:00:00Z', value: 1.2 }
    ]);
    expect(readings.get('A-level')).toEqual({ value: 1.3, at: '2026-10-19T14:15:00Z' });
  });

  it('keys by measure id and skips readings with no number', () => {
    const readings = toReadings([
      { measure: `${base}/measures/A-level`, dateTime: '2026-10-19T14:00:00Z', value: 1.2 },
      { measure: `${base}/measures/B-level`, dateTime: '2026-10-19T14:00:00Z' },
      { measure: `${base}/measures/C-level`, dateTime: '2026-10-19T14:00:00Z', value: [0.4, 0.5] }
    ]);
    expect([...readings.keys()]).toEqual(['A-level', 'C-level']);
    expect(readings.get('C-level')?.value).toBe(0.4);
  });
});

describe('toWarning', () => {
  const flood = {
    floodAreaID: '053FWFPUWI06',
    description: 'Watercourses in the Lincoln area',
    severityLevel: 2,
    timeRaised: '2026-10-19T09:00:00',
    message: '  River levels are rising.  ',
    floodArea: { county: 'Lincolnshire', riverOrSea: 'River Witham' }
  };

  it('places a warning at its area and keeps the message tidy', () => {
    const warning = toWarning(flood, { '053FWFPUWI06': [53.22, -0.55] });
    expect(warning).toMatchObject({ severity: 2, lat: 53.22, water: 'River Witham' });
    expect(warning?.message).toBe('River levels are rising.');
  });

  it("drops warnings that are no longer in force, or that don't say where or when", () => {
    expect(toWarning({ ...flood, severityLevel: 4 }, {})).toBeUndefined();
    expect(toWarning({ ...flood, floodAreaID: undefined }, {})).toBeUndefined();
    expect(toWarning({ ...flood, timeRaised: undefined }, {})).toBeUndefined();
  });
});
