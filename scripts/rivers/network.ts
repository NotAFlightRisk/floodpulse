import TinyQueue from 'tinyqueue';

export type Form = 'river' | 'tidal' | 'canal' | 'lake';
export type Position = [number, number];

/** One OS watercourse link, drawn source to mouth */
export interface Link {
  from: string;
  to: string;
  name?: string;
  form: Form;
  length: number;
  line: Position[];
}

export interface Spot {
  lon: number;
  lat: number;
  river?: string;
}

/** Where a gauge sits: which link, and how many metres down it */
export interface Snap {
  link: number;
  along: number;
}

const NONE = -1;

function index(links: Link[], end: 'from' | 'to') {
  const nodes = new Map<string, number[]>();
  links.forEach((link, i) => {
    const list = nodes.get(link[end]);
    if (list) list.push(i);
    else nodes.set(link[end], [i]);
  });
  return nodes;
}

export class Network {
  links: Link[];
  starts: Map<string, number[]>;
  ends: Map<string, number[]>;

  constructor(links: Link[]) {
    this.links = links;
    this.starts = index(links, 'from');
    this.ends = index(links, 'to');
  }

  downstream = (i: number) => this.starts.get(this.links[i].to) ?? [];
  upstream = (i: number) => this.ends.get(this.links[i].from) ?? [];
  touching = (node: string) => [...(this.ends.get(node) ?? []), ...(this.starts.get(node) ?? [])];
}

// where a river splits, most of it carries on under its own name and the side channels share the rest
const MAIN = 0.9;

function shares(links: Link[], from: number, branches: number[]) {
  const main = branches.filter((next) => links[from].name && links[next].name === links[from].name);
  if (!main.length || main.length === branches.length)
    return branches.map(() => 1 / branches.length);
  const rest = (1 - MAIN) / (branches.length - main.length);
  return branches.map((next) => (main.includes(next) ? MAIN / main.length : rest));
}

/** Metres of river draining into the end of each link; canals only count themselves */
export function drainage({ links, downstream, upstream }: Network) {
  const flows = (i: number) => links[i].form !== 'canal';
  const total = Float64Array.from(links, (link) => link.length);
  const waiting = links.map((_, i) => (flows(i) ? upstream(i).filter(flows).length : 0));
  const done = new Uint8Array(links.length);
  const drain = (start: number) => {
    const queue = [start];
    for (let i = queue.pop(); i !== undefined; i = queue.pop()) {
      done[i] = 1;
      if (!flows(i)) continue;
      const branches = downstream(i).filter(flows);
      shares(links, i, branches).forEach((share, n) => {
        const next = branches[n];
        total[next] += total[i] * share;
        if (--waiting[next] === 0) queue.push(next);
      });
    }
  };
  links.forEach((_, i) => waiting[i] === 0 && !done[i] && drain(i));
  // a loop never runs dry by itself, so let whatever's left go as it is
  links.forEach((_, i) => !done[i] && drain(i));
  return total;
}

export const plain = (name = '') =>
  name
    .toLowerCase()
    .replace(/^(river|afon|r\.)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// a river can run through a short nameless stretch, like a lock cut or a lake, and out again
const BRIDGE = { metres: 8_000, links: 8 };

/** Names the nameless links a river passes through on its way back to itself */
export function bridge({ links, downstream }: Network) {
  links.forEach((link, i) => {
    if (!link.name) return;
    const queue = downstream(i)
      .filter((next) => !links[next].name)
      .map((next) => ({ path: [next], metres: links[next].length }));
    for (const { path, metres } of queue)
      for (const next of downstream(path.at(-1)!)) {
        const far = metres + links[next].length;
        if (links[next].name === link.name) path.forEach((j) => (links[j].name = link.name));
        else if (!links[next].name && path.length < BRIDGE.links && far <= BRIDGE.metres)
          if (!path.includes(next)) queue.push({ path: [...path, next], metres: far });
      }
  });
}

/** Numbers each river, as the links that share a name and a node */
export function rivers({ links, touching }: Network) {
  const parent = links.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  const nodes = new Set(links.flatMap((link) => [link.from, link.to]));
  for (const node of nodes) {
    const byName = new Map<string, number>();
    for (const i of touching(node)) {
      const name = links[i].name;
      if (!name) continue;
      const seen = byName.get(name);
      if (seen === undefined) byName.set(name, i);
      else parent[root(i)] = root(seen);
    }
  }
  const numbers = new Map<number, number>();
  return Int32Array.from(links, (link, i) => {
    if (!link.name) return NONE;
    const key = root(i);
    if (!numbers.has(key)) numbers.set(key, numbers.size);
    return numbers.get(key)!;
  });
}

/** Metres from the end of each link down to where its own river stops */
export function fromMouth({ links, downstream, upstream }: Network, river: Int32Array) {
  const metres = new Float64Array(links.length).fill(Infinity);
  const queue = new TinyQueue<number>([], (a, b) => metres[a] - metres[b]);
  links.forEach((_, i) => {
    if (river[i] !== NONE && !downstream(i).some((next) => river[next] === river[i])) {
      metres[i] = 0;
      queue.push(i);
    }
  });
  while (queue.length) {
    const i = queue.pop()!;
    for (const above of upstream(i)) {
      const via = metres[i] + links[i].length;
      if (river[above] === river[i] && via < metres[above]) {
        metres[above] = via;
        queue.push(above);
      }
    }
  }
  return metres.map((m) => (Number.isFinite(m) ? m : 0));
}

// flat metres, which is plenty over the few hundred a gauge can be from its river
const EARTH = 6_371_000;
const RAD = Math.PI / 180;

function nearest([x, y]: Position, line: Position[], scale: number) {
  let best = { distance: Infinity, along: 0 };
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = [line[i - 1][0] * scale, line[i - 1][1]];
    const [dx, dy] = [line[i][0] * scale - ax, line[i][1] - ay];
    const span = Math.hypot(dx, dy);
    const t = span
      ? Math.max(0, Math.min(1, ((x * scale - ax) * dx + (y - ay) * dy) / span ** 2))
      : 0;
    const distance = Math.hypot(ax + t * dx - x * scale, ay + t * dy - y) * RAD * EARTH;
    if (distance < best.distance) best = { distance, along: walked + t * span };
    walked += span;
  }
  return { ...best, total: walked };
}

/** Buckets each link by the grid squares its corners fall in, for finding what's nearby */
export function grid(links: Link[], cell = 0.01) {
  const cells = new Map<string, number[]>();
  const key = (lon: number, lat: number) => `${Math.floor(lon / cell)}:${Math.floor(lat / cell)}`;
  links.forEach((link, i) => {
    const keys = new Set(link.line.map(([lon, lat]) => key(lon, lat)));
    for (const k of keys) {
      const list = cells.get(k);
      if (list) list.push(i);
      else cells.set(k, [i]);
    }
  });
  return (lon: number, lat: number, reach: number) => {
    const found = new Set<number>();
    for (let x = -reach; x <= reach; x++)
      for (let y = -reach; y <= reach; y++)
        for (const i of cells.get(key(lon + x * cell, lat + y * cell)) ?? []) found.add(i);
    return found;
  };
}

// a link with the gauge's own river name wins over a nearer one without, unless it's miles off
const WRONG_NAME = 250;
const LAKE = 200;

/** The link each spot sits on, within reach, preferring its own river's name */
export function snap(links: Link[], spots: Spot[], reach = 500) {
  const near = grid(links);
  return spots.map(({ lon, lat, river }): Snap | undefined => {
    const scale = Math.cos(lat * RAD);
    let best: (Snap & { score: number }) | undefined;
    for (const i of near(lon, lat, 2)) {
      const link = links[i];
      const hit = nearest([lon, lat], link.line, scale);
      if (hit.distance > reach) continue;
      const score =
        hit.distance +
        (river && plain(river) !== plain(link.name) ? WRONG_NAME : 0) +
        (link.form === 'lake' ? LAKE : 0);
      if (!best || score < best.score)
        best = { link: i, along: hit.total ? (hit.along / hit.total) * link.length : 0, score };
    }
    return best && { link: best.link, along: best.along };
  });
}

/** Cuts a line at fractions of the way along it, each cut point ending one piece and starting the next */
function cut(line: Position[], fractions: number[]) {
  const scale = Math.cos(line[0][1] * RAD);
  const spans = line
    .slice(1)
    .map(([x, y], i) => Math.hypot((x - line[i][0]) * scale, y - line[i][1]));
  const total = spans.reduce((sum, span) => sum + span, 0);
  const pieces: Position[][] = [[line[0]]];
  let walked = 0;
  let next = 0;
  spans.forEach((span, i) => {
    const [a, b] = [line[i], line[i + 1]];
    for (; next < fractions.length && walked + span >= fractions[next] * total; next++) {
      const t = span ? (fractions[next] * total - walked) / span : 0;
      const point: Position = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      pieces.at(-1)!.push(point);
      pieces.push([point]);
    }
    pieces.at(-1)!.push(b);
    walked += span;
  });
  return pieces;
}

// gauges closer than this share their piece, which is mostly a pair either side of a weir
const APART = 100;

/** Cuts a link halfway between the gauges on it, so each gets a stretch to call its own */
export function split(links: Link[], snaps: (Snap | undefined)[]) {
  const on = new Map<number, number[]>();
  snaps.forEach((at, gauge) => at && on.set(at.link, [...(on.get(at.link) ?? []), gauge]));
  const pieces: Link[] = [];
  const moved = [...snaps];
  links.forEach((link, i) => {
    const groups: number[][] = [];
    for (const gauge of (on.get(i) ?? []).sort((a, b) => snaps[a]!.along - snaps[b]!.along)) {
      const last = groups.at(-1);
      if (last && snaps[gauge]!.along - snaps[last.at(-1)!]!.along < APART) last.push(gauge);
      else groups.push([gauge]);
    }
    const cuts = groups
      .slice(1)
      .map((group, k) => (snaps[groups[k].at(-1)!]!.along + snaps[group[0]]!.along) / 2);
    const starts = [0, ...cuts];
    const nodes = [link.from, ...cuts.map((_, k) => `${i}>${k}`), link.to];
    cut(
      link.line,
      cuts.map((metres) => metres / link.length)
    ).forEach((line, k) => {
      const length = (cuts[k] ?? link.length) - starts[k];
      const index = pieces.push({ ...link, from: nodes[k], to: nodes[k + 1], line, length }) - 1;
      for (const gauge of groups[k] ?? [])
        moved[gauge] = { link: index, along: snaps[gauge]!.along - starts[k] };
    });
  });
  return { links: pieces, snaps: moved };
}

/** Gives every stretch to the nearest gauge along its own river, up to a limit each way */
export function assign(
  network: Network,
  river: Int32Array,
  snaps: (Snap | undefined)[],
  limit = 15_000,
  nameless = 3_000
) {
  const { links, touching } = network;
  const owner = new Int32Array(links.length).fill(NONE);
  const metres = new Float64Array(links.length).fill(Infinity);
  // distance, link, gauge, and for a gauge's own link, how far it sits off that link's middle
  type Step = [number, number, number, number?];
  const queue = new TinyQueue<Step>([], (a, b) => a[0] - b[0] || (a[3] ?? 0) - (b[3] ?? 0));
  snaps.forEach(
    (at, gauge) =>
      at && queue.push([0, at.link, gauge, Math.abs(at.along - links[at.link].length / 2)])
  );

  // the river a gauge sits on, or for a nameless one, just the nameless links around it
  const home = (gauge: number) => river[snaps[gauge]!.link];
  const belongs = (i: number, r: number) =>
    r === NONE ? river[i] === NONE && links[i].form !== 'lake' : river[i] === r;

  while (queue.length) {
    const [distance, i, gauge, off] = queue.pop()!;
    // two gauges on one link both spread from it, and the one nearer its middle keeps it
    const own = off !== undefined;
    if (owner[i] !== NONE && !own) continue;
    if (owner[i] === NONE) owner[i] = gauge;
    const at = snaps[gauge]!;
    const r = home(gauge);
    const far = r === NONE ? nameless : limit;
    for (const node of [links[i].from, links[i].to]) {
      // from the gauge itself, it's only as far as the end of its own link
      const out =
        i === at.link
          ? node === links[i].to
            ? links[i].length - at.along
            : at.along
          : links[i].length / 2;
      for (const next of touching(node)) {
        const via = distance + out + links[next].length / 2;
        if (owner[next] !== NONE || !belongs(next, r) || via > far || via >= metres[next]) continue;
        metres[next] = via;
        queue.push([via, next, gauge]);
      }
    }
  }
  return owner;
}

/** Strings links end to end where nothing joins or leaves and the key stays the same */
export function chains({ links, starts, ends }: Network, key: (i: number) => string) {
  const through = (i: number) => {
    const node = links[i].to;
    const [out, into] = [starts.get(node) ?? [], ends.get(node) ?? []];
    return out.length === 1 && into.length === 1 && key(out[0]) === key(i) ? out[0] : undefined;
  };
  const continued = new Set(links.map((_, i) => through(i)).filter((i) => i !== undefined));
  const used = new Uint8Array(links.length);
  const walk = (start: number) => {
    const chain: number[] = [];
    for (let i: number | undefined = start; i !== undefined && !used[i]; i = through(i)) {
      used[i] = 1;
      chain.push(i);
    }
    return chain;
  };
  const found = links
    .map((_, i) => i)
    .filter((i) => !continued.has(i))
    .map(walk);
  // anything left is a closed loop of pass-throughs
  links.forEach((_, i) => !used[i] && found.push(walk(i)));
  return found;
}
