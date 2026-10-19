import type { ExpressionSpecification, LayerSpecification } from '@maplibre/maplibre-gl-style-spec';

export const SOURCE = 'network';
// the same tiles keyed by river, so a whole one lights up through feature state
export const WHOLE = 'whole';
export const LAYER = 'rivers';
// too small to make out zoomed further out, where the colour's doing the work anyway
export const FLOW_FROM = 6;

// in line widths, which keeps the dashes in step with the river's size
const [DASH, GAP, STEPS] = [2, 4, 12];

/** Dashes that walk downstream, a frame at a time, for the rivers on the rise */
const DASHES = Array.from({ length: STEPS }, (_, step) => {
  const shift = (step / STEPS) * (DASH + GAP);
  return shift <= GAP ? [0, shift, DASH, GAP - shift] : [shift - GAP, GAP, DASH + GAP - shift];
});

// a layer per step, since changing the dashes themselves reloads every tile
export const FLOWS = DASHES.map((_, step) => `flow-${step}`);

// most of the network is brooks, so width stays low until the river gets properly big
const size = (low: number, high: number): ExpressionSpecification => [
  'interpolate',
  ['exponential', 1.25],
  ['get', 's'],
  0,
  low,
  13,
  high
];

/** Line width by zoom and by how much river drains through, plus a bit for a casing */
export const width = (scale = 1, extra = 0): ExpressionSpecification => [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  4,
  ['+', extra, ['*', scale, size(0.5, 2)]],
  6,
  ['+', extra, ['*', scale, size(0.65, 3)]],
  8,
  ['+', extra, ['*', scale, size(0.85, 5)]],
  12,
  ['+', extra, ['*', scale, size(1.2, 9)]],
  16,
  ['+', extra, ['*', scale, size(3, 20)]]
];

// p is the reading's place in its normal range, 0 at the bottom and 1 at the top
const p: ExpressionSpecification = ['feature-state', 'p'];

const unread: ExpressionSpecification = ['==', p, null];

/** Sand below normal, teal through it and lichen above, switching right at its edges */
export const ramp = ([low, normal, high, faint]: string[]): ExpressionSpecification => [
  'case',
  unread,
  faint,
  ['step', p, low, 0, normal, 1, high]
];

const lit: ExpressionSpecification = ['boolean', ['feature-state', 'lit'], false];
const watched: ExpressionSpecification = ['has', 'g'];

const STREAM = 0.5;

/** Everything faded but one river, when there's a river to look at */
const dim = (river: number | undefined): ExpressionSpecification | number =>
  river === undefined ? 1 : ['case', ['==', ['get', 'r'], river], 1, 0.25];

/** A soft casing round the river being pointed at, and a fainter one round the one in focus */
const glow: ExpressionSpecification = [
  'match',
  ['feature-state', 'glow'],
  'pointed',
  0.3,
  'focus',
  0.14,
  0
];

/** How solid each kind of line is, with a stretch that has nothing to compare against as faint */
export const opacity = (river?: number) => ({
  streams: ['*', STREAM, dim(river)] as ExpressionSpecification,
  reaches: ['*', ['case', unread, STREAM, 1], dim(river)] as ExpressionSpecification,
  ...Object.fromEntries(FLOWS.map((id) => [id, dim(river)]))
});

const line = (id: string, paint: object, filter?: ExpressionSpecification, source = SOURCE) =>
  ({
    id,
    type: 'line',
    source,
    'source-layer': LAYER,
    ...(filter && { filter }),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint
  }) as LayerSpecification;

export const LAYERS: LayerSpecification[] = [
  line('streams', { 'line-width': width(0.8), 'line-opacity': STREAM }, ['!', watched]),
  line('river-lit', { 'line-width': width(1.4, 4), 'line-opacity': glow }, ['has', 'r'], WHOLE),
  line(
    'reach-lit',
    { 'line-width': width(1.4, 4), 'line-opacity': ['case', lit, 0.9, 0] },
    watched
  ),
  line('reaches', { 'line-width': width(1.4) }, watched),
  ...DASHES.map((dashes, step) => ({
    ...line(
      FLOWS[step],
      {
        'line-width': width(0.5),
        'line-dasharray': dashes,
        'line-layer-opacity': step ? 0 : 1,
        'line-layer-opacity-transition': { duration: 0 }
      },
      ['in', ['get', 'g'], '']
    ),
    minzoom: FLOW_FROM
  })),
  {
    id: 'river-names',
    type: 'symbol',
    source: SOURCE,
    'source-layer': LAYER,
    minzoom: 8,
    // only the big rivers get a name until there's room for the brooks
    filter: [
      'all',
      ['has', 'n'],
      ['>=', ['get', 's'], ['step', ['zoom'], 10, 9, 8, 10, 6, 11, 4, 12, 0]]
    ],
    layout: {
      'symbol-placement': 'line',
      'symbol-sort-key': ['-', 13, ['get', 's']],
      'text-field': ['get', 'n'],
      'text-font': ['Noto Sans Italic'],
      'text-size': 12,
      'text-letter-spacing': 0.05
    },
    paint: { 'text-halo-width': 1.5 }
  },
  // invisible and fat, so a finger doesn't have to land on a hairline
  line('network-hit', { 'line-width': 16, 'line-opacity': 0 }, ['any', watched, ['has', 'r']])
];
