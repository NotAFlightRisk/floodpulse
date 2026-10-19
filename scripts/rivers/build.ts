// Turns OS Open Rivers and the EA's gauge list into map tiles and src/lib/data/rivers.json
// usage: npm run rivers -- path/to/oprvrs_gb.gpkg (GeoPackage from the OS Data Hub, OGL)
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { GeoJSONVT } from '@maplibre/geojson-vt';
import { fromGeojsonVt } from '@maplibre/vt-pbf';
import { items, toStation } from '../../src/lib/server/ea.ts';
import type { Station } from '../../src/lib/types.ts';
import {
  assign,
  bridge,
  chains,
  drainage,
  fromMouth,
  Network,
  rivers,
  snap,
  split,
  type Position
} from './network.ts';
import { EAST, NORTH, readLinks, SOUTH, WEST } from './os.ts';

const [MIN_ZOOM, MAX_ZOOM] = [4, 10];
// the map starts naming rivers here, so the tiles start carrying names and exact sizes
const LABELS = 8;
const TILES = 'static/rivers';
const INDEX = 'src/lib/data';

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/^(river|afon)\s+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// size by how much river drains through, doubling per step, so the Thames outranks a brook
const size = (metres: number) => Math.max(0, Math.min(13, Math.round(Math.log2(metres / 1000))));

const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;

const bounds = (points: Position[]) =>
  points
    .reduce(
      ([w, s, e, n], [lon, lat]) => [
        Math.min(w, lon),
        Math.min(s, lat),
        Math.max(e, lon),
        Math.max(n, lat)
      ],
      [Infinity, Infinity, -Infinity, -Infinity]
    )
    .map((v) => round(v, 4));

async function main(path: string) {
  const stations = (await items('/id/stations?parameter=level&_view=full&_limit=10000'))
    .map(toStation)
    .filter((s): s is Station => s !== undefined && s.kind !== 'ground');
  const raw = readLinks(path);
  const { links, snaps } = split(raw, snap(raw, stations));
  const network = new Network(links);
  bridge(network);
  const drained = drainage(network);
  const river = rivers(network);
  const mouth = fromMouth(network, river);
  const owner = assign(network, river, snaps);
  console.log(`${links.length} links`);
  console.log(`${snaps.filter(Boolean).length} of ${stations.length} gauges on a river`);

  // every river with a gauge on it, longest first
  const members = new Map<number, number[]>();
  links.forEach((_, i) => {
    if (river[i] < 0) return;
    const list = members.get(river[i]);
    if (list) list.push(i);
    else members.set(river[i], [i]);
  });
  const gauged = [
    ...new Set(snaps.flatMap((at) => (at && river[at.link] >= 0 ? [river[at.link]] : [])))
  ];
  const most = (r: number, of: (i: number) => number) =>
    members.get(r)!.reduce((best, i) => Math.max(best, of(i)), 0);
  const lengths = new Map(gauged.map((r) => [r, most(r, (i) => mouth[i] + links[i].length)]));
  gauged.sort((a, b) => lengths.get(b)! - lengths.get(a)!);
  const listed = new Map(gauged.map((r, i) => [r, i]));
  const fromSource = (r: number, i: number, along: number) =>
    round((lengths.get(r)! - mouth[i] - (links[i].length - along)) / 1000);

  const index = gauged.map((r) => {
    const own = members.get(r)!;
    const gauges = stations
      .map((station, g) => [station, snaps[g]] as const)
      .filter(([, at]) => at && river[at.link] === r)
      .map(([station, at]) => [station.id, fromSource(r, at!.link, at!.along)] as [string, number])
      .sort((a, b) => a[1] - b[1]);
    // the lowest town on it, for telling two Avons apart
    const place = gauges.map(([id]) => stations.find((s) => s.id === id)!.town).findLast(Boolean);
    const end =
      own.filter((i) => mouth[i] === 0).sort((a, b) => drained[b] - drained[a])[0] ?? own[0];
    // past the end of this river, through any nameless bits, to whatever it joins
    let next = network.downstream(end);
    for (let hops = 0; hops < 5 && next.length && river[next[0]] < 0; hops++)
      next = network.downstream(next[0]);
    const joins = next.find((i) => river[i] !== r && listed.has(river[i]));
    return {
      slug: slugify(links[own[0]].name!),
      name: links[own[0]].name!,
      place,
      length: round(lengths.get(r)! / 1000),
      bounds: bounds(own.flatMap((i) => links[i].line)),
      into:
        joins === undefined
          ? undefined
          : [listed.get(river[joins])!, fromSource(river[joins], joins, 0)],
      sea: !next.length && links[end].form === 'tidal' ? true : undefined,
      gauges
    };
  });

  // two Avons get told apart by what they flow into, or the town at their lower end, then by number
  const taken = new Map<string, number>();
  for (const entry of index) taken.set(entry.slug, (taken.get(entry.slug) ?? 0) + 1);
  const seen = new Set<string>();
  for (const entry of index) {
    const telling = entry.into
      ? slugify(index[entry.into[0]].name)
      : entry.place && slugify(entry.place);
    if (taken.get(entry.slug)! > 1 && telling) entry.slug += `-${telling}`;
    let slug = entry.slug;
    for (let n = 2; seen.has(slug); n++) slug = `${entry.slug}-${n}`;
    seen.add((entry.slug = slug));
  }

  const ids = stations.map((s) => s.id);
  const sized = Array.from(drained, size);

  /** The lines drawn at one zoom, joined end to end wherever the tributaries are too small to show */
  const linesAt = (z: number) => {
    const shown = links
      .map((_, i) => i)
      .filter((i) => links[i].form !== 'lake' && sized[i] >= smallest(z, owner[i] >= 0));
    const close = z >= LABELS;
    const at = (j: number) => shown[j];
    const key = (j: number) =>
      `${owner[at(j)]}|${river[at(j)]}|${links[at(j)].form}|${close ? sized[at(j)] : ''}`;
    return chains(new Network(shown.map((i) => links[i])), key).map((chain) => {
      const i = at(chain[0]);
      const r = listed.get(river[i]);
      const metres = chain.reduce((sum, j) => sum + links[at(j)].length, 0);
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: chain.flatMap((j, n) => (n ? links[at(j)].line.slice(1) : links[at(j)].line))
        },
        properties: {
          // zoomed out, one width a line is plenty, so it's the average along it
          s: Math.round(
            chain.reduce((sum, j) => sum + sized[at(j)] * links[at(j)].length, 0) / metres
          ),
          ...(owner[i] >= 0 && { g: ids[owner[i]] }),
          ...(r !== undefined && { r }),
          ...(close && links[i].name && { n: links[i].name }),
          ...(links[i].form === 'tidal' && { f: 't' }),
          ...(links[i].form === 'canal' && { f: 'c' })
        }
      };
    });
  };

  const version = createHash('sha1')
    .update(JSON.stringify(index))
    .update(String(links.length))
    .digest('hex')
    .slice(0, 8);
  rmSync(TILES, { recursive: true, force: true });
  let written = 0;
  let bytes = 0;
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const lines = linesAt(z);
    const tiles = new GeoJSONVT(
      { type: 'FeatureCollection', features: lines },
      // geojson-vt keeps every vertex at its max zoom, which only the last zoom wants
      { maxZoom: z === MAX_ZOOM ? z : z + 1, indexMaxZoom: 0, tolerance: 3, buffer: 16 }
    );
    const [x0, y0] = tileOf(WEST, NORTH, z);
    const [x1, y1] = tileOf(EAST, SOUTH, z);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const tile = tiles.getTile(z, x, y);
        // an empty file for open sea, so a missing tile never falls through to the app
        const pbf = tile?.features.length
          ? fromGeojsonVt({ rivers: tile }, { version: 2 })
          : new Uint8Array();
        mkdirSync(`${TILES}/${version}/${z}/${x}`, { recursive: true });
        writeFileSync(`${TILES}/${version}/${z}/${x}/${y}.pbf`, pbf);
        written++;
        bytes += pbf.length;
      }
    console.log(`z${z}: ${lines.length} lines`);
  }
  console.log(`${written} tiles, ${round(bytes / 1e6)} MB`);

  mkdirSync(INDEX, { recursive: true });
  writeFileSync(
    `${INDEX}/rivers.json`,
    JSON.stringify({
      tiles: `/rivers/${version}/{z}/{x}/{y}.pbf`,
      bounds: [WEST, SOUTH, EAST, NORTH],
      rivers: index
    })
  );
}

/** The smallest size class drawn at each zoom; stretches with a gauge show a little sooner */
function smallest(z: number, watched: boolean) {
  const bySize = [9, 7, 5, 4, 3, 1, 0][z - MIN_ZOOM];
  return watched ? Math.max(0, bySize - 2) : bySize;
}

function tileOf(lon: number, lat: number, z: number) {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return [
    Math.floor(((lon + 180) / 360) * n),
    Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)
  ];
}

await main(process.argv[2]);
