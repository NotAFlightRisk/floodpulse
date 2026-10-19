import type { LayerSpecification, StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

export type Token =
  'land' | 'park' | 'water' | 'river' | 'road' | 'border' | 'label' | 'halo' | 'shade' | 'light';
export type Palette = Record<Token, string>;

const TOKENS: Token[] = [
  'land',
  'park',
  'water',
  'river',
  'road',
  'border',
  'label',
  'halo',
  'shade',
  'light'
];

/** Reads CSS tokens as real colours, since light-dark() only resolves on a real property */
export function resolve(names: string[]) {
  const probe = document.body.appendChild(document.createElement('i'));
  const colours = names.map((name) => {
    probe.style.color = `var(--${name})`;
    return getComputedStyle(probe).color;
  });
  probe.remove();
  return colours;
}

export const palette = (): Palette =>
  Object.fromEntries(
    resolve(TOKENS.map((token) => `map-${token}`)).map((c, i) => [TOKENS[i], c])
  ) as Palette;

const OSM = 'openmaptiles';
const sans = ['Noto Sans Regular'];
const italic = ['Noto Sans Italic'];
const width = (stops: number[]) => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops];

// [layer, paint property, token], so a theme change can repaint without rebuilding the style
export const PAINT: [string, string, Token][] = [
  ['land', 'background-color', 'land'],
  ['park', 'fill-color', 'park'],
  ['relief', 'hillshade-shadow-color', 'shade'],
  ['relief', 'hillshade-highlight-color', 'light'],
  ['relief', 'hillshade-accent-color', 'shade'],
  ['water', 'fill-color', 'water'],
  ['rivers', 'line-color', 'river'],
  ['streams', 'line-color', 'river'],
  ['roads', 'line-color', 'road'],
  ['borders', 'line-color', 'border'],
  ['river-names', 'text-color', 'river'],
  ['river-names', 'text-halo-color', 'halo'],
  ['places', 'text-color', 'label'],
  ['places', 'text-halo-color', 'halo']
];

const LAYERS = [
  { id: 'land', type: 'background' },
  {
    id: 'park',
    type: 'fill',
    source: OSM,
    'source-layer': 'park',
    paint: { 'fill-opacity': 0.7 }
  },
  {
    id: 'relief',
    type: 'hillshade',
    source: 'dem',
    paint: { 'hillshade-exaggeration': 0.35 }
  },
  { id: 'water', type: 'fill', source: OSM, 'source-layer': 'water' },
  {
    id: 'streams',
    type: 'line',
    source: OSM,
    'source-layer': 'waterway',
    minzoom: 10,
    filter: ['in', ['get', 'class'], ['literal', ['stream', 'drain', 'ditch']]],
    paint: { 'line-width': width([10, 0.4, 15, 1.5]), 'line-opacity': 0.7 }
  },
  {
    id: 'rivers',
    type: 'line',
    source: OSM,
    'source-layer': 'waterway',
    filter: ['in', ['get', 'class'], ['literal', ['river', 'canal']]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-width': width([5, 1.2, 8, 1.6, 13, 3, 16, 6]) }
  },
  {
    id: 'roads',
    type: 'line',
    source: OSM,
    'source-layer': 'transportation',
    minzoom: 7,
    filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
    paint: { 'line-width': width([7, 0.4, 12, 1.5, 16, 6]), 'line-opacity': 0.75 }
  },
  {
    id: 'borders',
    type: 'line',
    source: OSM,
    'source-layer': 'boundary',
    filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
    paint: { 'line-width': 1, 'line-dasharray': [3, 2] }
  },
  {
    id: 'river-names',
    type: 'symbol',
    source: OSM,
    'source-layer': 'waterway',
    minzoom: 10,
    filter: ['all', ['has', 'name'], ['in', ['get', 'class'], ['literal', ['river', 'canal']]]],
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'name:en'],
      'text-font': italic,
      'text-size': 12,
      'text-letter-spacing': 0.05
    },
    paint: { 'text-halo-width': 1.5 }
  },
  {
    id: 'places',
    type: 'symbol',
    source: OSM,
    'source-layer': 'place',
    filter: [
      'any',
      ['==', ['get', 'class'], 'city'],
      ['all', ['==', ['get', 'class'], 'town'], ['>=', ['zoom'], 8]],
      ['all', ['==', ['get', 'class'], 'village'], ['>=', ['zoom'], 11]]
    ],
    layout: {
      'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
      'text-font': sans,
      'text-size': ['match', ['get', 'class'], 'city', 13, 'town', 12, 11],
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.12,
      'text-max-width': 8
    },
    paint: { 'text-halo-width': 1.5 }
  }
] as LayerSpecification[];

export function basemap(colours: Palette): StyleSpecification {
  const layers = structuredClone(LAYERS);
  for (const [id, property, token] of PAINT) {
    const layer = layers.find((candidate) => candidate.id === id)!;
    layer.paint = { ...layer.paint, [property]: colours[token] } as typeof layer.paint;
  }
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      [OSM]: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution:
          '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      },
      dem: {
        type: 'raster-dem',
        url: 'https://tiles.mapterhorn.com/tilejson.json',
        encoding: 'terrarium',
        tileSize: 512
      }
    },
    layers
  };
}
