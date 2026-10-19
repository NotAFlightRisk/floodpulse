import { describe, expect, it } from 'vitest';
import {
  assign,
  bridge,
  drainage,
  fromMouth,
  Network,
  rivers,
  snap,
  split,
  type Link
} from '../../../scripts/rivers/network.ts';

// a straight line due east at 52N, a kilometre a link, which is all these need
const link = (from: string, to: string, name?: string, length = 1000): Link => {
  const [x, y] = [Number(from.slice(1)) / 100, 52 + from.charCodeAt(0) / 1000];
  return {
    from,
    to,
    name,
    form: 'river',
    length,
    line: [
      [x, y],
      [x + 0.0146, y]
    ]
  };
};

describe('drainage', () => {
  it('adds up what joins at a confluence', () => {
    const network = new Network([
      link('a1', 'a2', 'X'),
      link('b1', 'a2', 'Y', 500),
      link('a2', 'a3', 'X')
    ]);
    expect(drainage(network)[2]).toBe(2500);
  });

  it("doesn't count a river twice where it splits round an island and meets itself again", () => {
    const network = new Network([
      link('a1', 'a2', 'X'),
      link('a2', 'a3', 'X'),
      link('a2', 'a3', undefined),
      link('a3', 'a4', 'X')
    ]);
    // 1 km in, shared 90/10 down the two channels, then all of it back together
    expect(drainage(network)[3]).toBe(1000 + 1900 + 1100);
  });

  it('counts a loop once, rather than going round it again', () => {
    const network = new Network([
      link('a1', 'a2'),
      link('a2', 'a3'),
      link('a3', 'a2'),
      link('a3', 'a4')
    ]);
    // 2 km reaches a3, then half carries on and half goes back round, and stops there
    expect(drainage(network)[3]).toBe(1000 + 1000);
  });
});

describe('rivers', () => {
  it('carries a river through a nameless lock cut and calls it one river', () => {
    const network = new Network([
      link('a1', 'a2', 'River Thames'),
      link('a2', 'a3', undefined, 300),
      link('a3', 'a4', 'River Thames'),
      link('b1', 'a2', 'River Kennet')
    ]);
    bridge(network);
    const river = rivers(network);
    expect(network.links[1].name).toBe('River Thames');
    expect(new Set([river[0], river[1], river[2]]).size).toBe(1);
    expect(river[3]).not.toBe(river[0]);
  });

  it('leaves a nameless stream alone when it never finds its way back to a river', () => {
    const network = new Network([link('a1', 'a2', 'River Thames'), link('a2', 'a3')]);
    bridge(network);
    expect(rivers(network)[1]).toBe(-1);
  });
});

describe('fromMouth', () => {
  it('measures each link from its end down to where the river stops', () => {
    const network = new Network([
      link('a1', 'a2', 'X'),
      link('a2', 'a3', 'X', 2000),
      link('a3', 'a4', 'Y')
    ]);
    expect([...fromMouth(network, rivers(network))]).toEqual([2000, 0, 0]);
  });
});

describe('snap', () => {
  const links = [link('a100', 'a101', 'River Ouse'), link('a100', 'a101', 'River Foss')];

  it("picks the link with the gauge's own river name over a nearer one", () => {
    links[1].line = links[1].line.map(([x, y]) => [x, y + 0.001]);
    const [found] = snap(links, [{ lon: 1.005, lat: 52.0975 + 0.0008, river: 'Ouse' }]);
    expect(found?.link).toBe(0);
  });

  it('gives up on a gauge that is nowhere near a river', () => {
    expect(snap(links, [{ lon: 1.005, lat: 53 }])).toEqual([undefined]);
  });
});

describe('assign', () => {
  // X runs a1 to a6 in five 1 km links, with Y joining at a3
  const network = new Network([
    link('a1', 'a2', 'X'),
    link('a2', 'a3', 'X'),
    link('a3', 'a4', 'X'),
    link('a4', 'a5', 'X'),
    link('a5', 'a6', 'X'),
    link('b1', 'a3', 'Y')
  ]);
  const river = rivers(network);

  it('splits a river between its gauges, each taking the stretch nearest it', () => {
    const owner = assign(network, river, [
      { link: 0, along: 500 },
      { link: 4, along: 600 }
    ]);
    expect([...owner.slice(0, 5)]).toEqual([0, 0, 0, 1, 1]);
  });

  it('lets two gauges on one link each take the river on their own side', () => {
    const owner = assign(network, river, [
      { link: 2, along: 150 },
      { link: 2, along: 900 }
    ]);
    expect([...owner.slice(0, 5)]).toEqual([0, 0, 0, 1, 1]);
  });

  it('keeps a gauge to its own river, not the tributary next to it', () => {
    const owner = assign(network, river, [{ link: 1, along: 900 }]);
    expect(owner[5]).toBe(-1);
  });

  it('stops a lone gauge a set distance either side of itself', () => {
    // the next link's middle is 2 km off, so 1.8 km falls short of it
    const owner = assign(network, river, [{ link: 0, along: 500 }], 1800);
    expect([...owner.slice(0, 5)]).toEqual([0, 0, -1, -1, -1]);
  });
});

describe('split', () => {
  it('cuts a long link halfway between its gauges, and moves each gauge onto its own piece', () => {
    const long = link('a1', 'a2', 'X', 4000);
    const { links, snaps } = split(
      [long],
      [
        { link: 0, along: 1000 },
        { link: 0, along: 3000 }
      ]
    );
    expect(links.map((piece) => piece.length)).toEqual([2000, 2000]);
    expect(links[0].to).toBe(links[1].from);
    expect(links[0].line.at(-1)).toEqual(links[1].line[0]);
    expect(snaps).toEqual([
      { link: 0, along: 1000 },
      { link: 1, along: 1000 }
    ]);
  });

  it('leaves twin gauges either side of a weir sharing one piece', () => {
    const { links } = split(
      [link('a1', 'a2', 'X')],
      [
        { link: 0, along: 500 },
        { link: 0, along: 540 }
      ]
    );
    expect(links).toHaveLength(1);
  });
});
