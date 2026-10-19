import { DatabaseSync } from 'node:sqlite';
import { fromEastNorth } from '../../src/lib/server/grid.ts';
import type { Form, Link, Position } from './network.ts';

// England and Wales, with the Tweed for company
export const [WEST, SOUTH, EAST, NORTH] = [-6.5, 49.8, 2.0, 56.0];

const FORMS: Record<string, Form> = {
  inlandRiver: 'river',
  tidalRiver: 'tidal',
  canal: 'canal',
  lake: 'lake'
};

interface Row {
  geometry: Uint8Array;
  form: string;
  name: string | null;
  other: string | null;
  length: number;
}

/** A GeoPackage line in National Grid metres: its own header, then plain little-endian WKB */
function metres(blob: Uint8Array): Position[] {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const envelope = [0, 32, 48, 48, 64][(view.getUint8(3) >> 1) & 7];
  const start = 8 + envelope;
  const little = view.getUint8(start) === 1;
  const dims = view.getUint32(start + 1, little) > 1000 ? 3 : 2;
  const count = view.getUint32(start + 5, little);
  return Array.from({ length: count }, (_, i) => {
    const at = start + 9 + i * dims * 8;
    return [view.getFloat64(at, little), view.getFloat64(at + 8, little)];
  });
}

// a stretch with a local name like Sandford Pool files the river's own second, and in Wales
// the Welsh comes first, so the English river name wins wherever there is one
const rank = (name: string | null) =>
  !name ? 3 : /^River\s/.test(name) ? 0 : /^Afon\s/.test(name) ? 1 : 2;
const pick = (name: string | null, other: string | null) =>
  (rank(other) < rank(name) ? other : name) ?? undefined;

// nodes go by where they are, to the metre, so mend() can find the near misses
const spot = ([east, north]: Position) => `${Math.round(east)}:${Math.round(north)}`;

const inside = ([lon, lat]: Position) => lon > WEST && lon < EAST && lat > SOUTH && lat < NORTH;

/** Joins a link that stops just short of the next stretch of its river, as a few do */
function mend(links: Link[], gap = 100) {
  const starts = new Map<string, Link[]>();
  for (const link of links) starts.set(link.from, [...(starts.get(link.from) ?? []), link]);
  const cell = (east: number, north: number) =>
    `${Math.floor(east / gap)}:${Math.floor(north / gap)}`;
  const cells = new Map<string, string[]>();
  for (const node of starts.keys()) {
    const key = cell(...(node.split(':').map(Number) as Position));
    cells.set(key, [...(cells.get(key) ?? []), node]);
  }
  for (const link of links) {
    if (!link.name || starts.has(link.to)) continue;
    const [east, north] = link.to.split(':').map(Number);
    let best = { node: '', metres: gap };
    for (const dx of [-1, 0, 1])
      for (const dy of [-1, 0, 1])
        for (const node of cells.get(cell(east + dx * gap, north + dy * gap)) ?? []) {
          const [e, n] = node.split(':').map(Number);
          const metres = Math.hypot(e - east, n - north);
          const same = starts.get(node)!.some((next) => next.name === link.name);
          if (node !== link.from && same && metres <= best.metres) best = { node, metres };
        }
    if (best.node) link.to = best.node;
  }
  return links;
}

/** Every watercourse link in OS Open Rivers that comes within the map, in WGS84 */
export function readLinks(path: string): Link[] {
  const db = new DatabaseSync(path, { readOnly: true });
  const rows = db
    .prepare(
      `select geometry, form, watercourse_name as name, watercourse_name_alternative as other, length
       from watercourse_link`
    )
    .all() as unknown as Row[];
  db.close();
  const links = rows.map((row) => {
    const grid = metres(row.geometry);
    return {
      from: spot(grid[0]),
      to: spot(grid.at(-1)!),
      name: pick(row.name, row.other),
      form: FORMS[row.form] ?? 'river',
      length: row.length,
      line: grid.map(([east, north]) => fromEastNorth(east, north).reverse() as Position)
    };
  });
  return mend(links).filter((link) => link.line.some(inside));
}
