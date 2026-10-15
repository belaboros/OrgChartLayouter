import { describe, it, expect } from 'vitest';
import { parseTeams } from '../../src/model/parse';
import { radial } from '../../src/layouts/radial';
import { resolveOptions } from '../../src/plugins/options';
import { shapeCenter, shapeRect, unionRects } from '../../src/geometry/rect';
import { boxFor } from '../../src/layouts/label';
import { fakeCtx } from '../helpers/fake-measure';
import { loadTree } from '../helpers/trees';
import type { PlacedNode, Rect } from '../../src/plugins/types';

const opts = (o = {}) => resolveOptions(radial.optionsSchema, o);
const medium = loadTree('src/samples/medium.teams.yaml');
const r = radial.run(medium, opts(), fakeCtx);
const dist = (n: PlacedNode) => Math.hypot(shapeCenter(n.shape).x, shapeCenter(n.shape).y);
const ang = (n: PlacedNode) => {
  const c = shapeCenter(n.shape);
  return (Math.atan2(c.y, c.x) + 2 * Math.PI) % (2 * Math.PI);
};
const tree = (s: string) => parseTeams(s).tree;
/** Every two boxes are at least 4 px apart along x or along y. */
const expectBoxesApart = (nodes: PlacedNode[]) => {
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i].shape as Rect, b = nodes[j].shape as Rect;
    const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
    const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    expect(Math.max(gapX, gapY), `${nodes[i].name} vs ${nodes[j].name}`).toBeGreaterThanOrEqual(4 - 1e-6);
  }
};

describe('radial', () => {
  it('outward with origin at 0,0', () => expect([r.direction, r.origin]).toEqual(['outward', { x: 0, y: 0 }]));
  it('declares its options', () => {
    expect(radial.id).toBe('radial');
    expect(opts()).toEqual({ ringSpacing: 80, nodeStyle: 'dots' });
  });
  it('each depth sits on one ring, and rings grow by at least ringSpacing', () => {
    const rings = [1, 2, 3, 4].map((d) => r.nodes.filter((n) => n.depth === d).map(dist));
    rings.forEach((ring) => ring.forEach((v) => expect(v).toBeCloseTo(ring[0], 3)));
    expect(rings[0][0]).toBeGreaterThanOrEqual(80 - 0.01);
    for (let d = 1; d < 4; d++) expect(rings[d][0] - rings[d - 1][0]).toBeGreaterThanOrEqual(80 - 0.01);
  });
  it('ringSpacing is honoured', () => {
    const t = tree('A:\n  B:\n    C:\n');
    const rr = radial.run(t, opts({ ringSpacing: 150 }), fakeCtx);
    expect(rr.nodes.map(dist).map((v) => Math.round(v))).toEqual([150, 300, 450]);
  });
  it('dots mode uses dots with readable rotation', () => r.nodes.forEach((n) => {
    expect(n.shape).toMatchObject({ kind: 'dot', r: 4 });
    expect(n.label.rotate > -90 && n.label.rotate <= 90).toBe(true);
  }));
  it('boxes mode uses centred rects with unrotated centred labels', () => {
    const b = radial.run(medium, opts({ nodeStyle: 'boxes' }), fakeCtx);
    for (const n of b.nodes) {
      expect(n.shape.kind).toBe('rect');
      const s = n.shape as Rect;
      const bx = boxFor(n.name, fakeCtx);
      expect([s.w, s.h]).toEqual([bx.w, bx.h]);
      expect(n.label.x).toBeCloseTo(s.x + s.w / 2, 6);
      expect(n.label.y).toBeCloseTo(s.y + s.h / 2, 6);
      expect([n.label.anchor, n.label.rotate, n.label.text]).toEqual(['middle', 0, n.name]);
    }
  });
  it('node metadata mirrors the tree', () => {
    const t = tree('A:\n  B:\n    C:\nD:\n');
    const rr = radial.run(t, opts(), fakeCtx);
    const by = (nm: string) => rr.nodes.find((n) => n.name === nm)!;
    expect([by('A'), by('B'), by('C'), by('D')].map((n) => [n.depth, n.parentId, n.stacked])).toEqual([
      [1, null, false], [2, by('A').id, false], [3, by('B').id, false], [1, null, false],
    ]);
  });
  it('angle 0 is +x and angles grow toward +y', () => {
    const rr = radial.run(tree('A:\n'), opts(), fakeCtx);
    expect(dist(rr.nodes[0])).toBeCloseTo(80, 3);
    const two = radial.run(tree('A:\nB:\n'), opts(), fakeCtx);
    // d3 reserves half a slot at each end: two nodes sit at 90 and 270 degrees. y grows downward on screen.
    const c0 = shapeCenter(two.nodes[0].shape), c1 = shapeCenter(two.nodes[1].shape);
    expect([c0.x, c0.y]).toEqual([expect.closeTo(0, 3), expect.closeTo(80, 3)]);
    expect([c1.x, c1.y]).toEqual([expect.closeTo(0, 3), expect.closeTo(-80, 3)]);
    const four = radial.run(tree('A:\nB:\nC:\nD:\n'), opts(), fakeCtx);
    expect(four.nodes.map((n) => Math.round((ang(n) * 180) / Math.PI))).toEqual([45, 135, 225, 315]);
  });
  it('dot labels: 8 px outward along the ray, rotated, anchored by half', () => {
    const rr = radial.run(tree('A:\nB:\nC:\nD:\n'), opts(), fakeCtx);
    expect(rr.nodes.length).toBe(4);
    for (const n of rr.nodes) {
      const c = shapeCenter(n.shape);
      const th = Math.atan2(c.y, c.x);
      expect(n.label.x).toBeCloseTo(c.x + 8 * Math.cos(th), 3);
      expect(n.label.y).toBeCloseTo(c.y + 8 * Math.sin(th), 3);
      expect(n.label.anchor).toBe(Math.cos(th) >= 0 ? 'start' : 'end');
      const deg = (th * 180) / Math.PI;
      const want = Math.cos(th) >= -1e-9 ? deg : deg > 0 ? deg - 180 : deg + 180;
      expect(n.label.rotate).toBeCloseTo(want, 3);
    }
    expect(rr.nodes.some((n) => n.label.anchor === 'end')).toBe(true);
    expect(rr.nodes.some((n) => n.label.anchor === 'start')).toBe(true);
  });
  it('dots mode shows every team name in full', () => {
    for (const name of ['medium', 'large']) {
      const rr = radial.run(loadTree(`src/samples/${name}.teams.yaml`), opts(), fakeCtx);
      for (const n of rr.nodes) expect(n.label.text).toBe(n.name);
    }
  });
  it('a long label pushes the next ring out instead of being cut', () => {
    const long = 'X'.repeat(40);
    const rr = radial.run(tree(`${long}:\n  ${long}Y:\n`), opts({ ringSpacing: 80 }), fakeCtx);
    const top = rr.nodes.find((n) => n.name === long)!;
    const leaf = rr.nodes.find((n) => n.name === `${long}Y`)!;
    expect(top.label.text).toBe(long);
    // label offset 8 + label width + margin 12
    expect(dist(leaf) - dist(top)).toBeCloseTo(8 + fakeCtx.measure(long, fakeCtx.fontSize).width + 12, 6);
  });
  it('no dot label reaches the next ring out', () => {
    const rr = radial.run(loadTree('src/samples/large.teams.yaml'), opts(), fakeCtx);
    const ringRadius = (d: number) => dist(rr.nodes.find((n) => n.depth === d)!);
    const maxDepth = Math.max(...rr.nodes.map((n) => n.depth));
    for (const n of rr.nodes.filter((m) => m.depth < maxDepth)) {
      const end = dist(n) + 8 + fakeCtx.measure(n.label.text, fakeCtx.fontSize).width;
      expect(end, n.name).toBeLessThanOrEqual(ringRadius(n.depth + 1) - 12 + 1e-6);
    }
  });
  it('rings expand so crowded same-depth boxes keep a 4 px gap on some axis', () => {
    const names = Array.from({ length: 30 }, (_, i) => `Team${i}`.padEnd(14, 'x'));
    const t = tree(names.map((n) => `${n}:`).join('\n') + '\n');
    const rr = radial.run(t, opts({ nodeStyle: 'boxes' }), fakeCtx);
    expect(dist(rr.nodes[0])).toBeGreaterThan(80);
    expectBoxesApart(rr.nodes);
  });
  for (const [name, maxW, maxH] of [['medium', 1020, 860], ['large', 1800, 1250]] as const) {
    it(`boxes mode on the ${name} sample stays compact and overlap-free`, () => {
      const rr = radial.run(loadTree(`src/samples/${name}.teams.yaml`), opts({ nodeStyle: 'boxes' }), fakeCtx);
      expect(rr.bounds.w).toBeLessThanOrEqual(maxW);
      expect(rr.bounds.h).toBeLessThanOrEqual(maxH);
      expectBoxesApart(rr.nodes);
    });
  }
  it('R2: ring gap covers neighbouring max extents in boxes mode', () => {
    const t = tree(`${'W'.repeat(60)}:\n  ${'V'.repeat(60)}:\n`);
    const rr = radial.run(t, opts({ nodeStyle: 'boxes', ringSpacing: 30 }), fakeCtx);
    const ext = (n: PlacedNode) => Math.hypot((n.shape as Rect).w, (n.shape as Rect).h);
    expect(dist(rr.nodes[1]) - dist(rr.nodes[0])).toBeGreaterThanOrEqual((ext(rr.nodes[0]) + ext(rr.nodes[1])) / 2 + 4 - 1e-6);
  });
  it('R16: dots mode on the small sample keeps every label far end inside bounds', () => {
    const small = loadTree('src/samples/small.teams.yaml');
    const rr = radial.run(small, opts(), fakeCtx);
    const b = rr.bounds;
    const inside = (x: number, y: number) => x >= b.x - 0.5 && x <= b.x + b.w + 0.5 && y >= b.y - 0.5 && y <= b.y + b.h + 0.5;
    for (const n of rr.nodes) {
      const c = shapeCenter(n.shape);
      const th = Math.atan2(c.y, c.x);
      const len = fakeCtx.measure(n.label.text, fakeCtx.fontSize).width;
      const far = { x: n.label.x + len * Math.cos(th), y: n.label.y + len * Math.sin(th) };
      expect(inside(far.x, far.y), `${n.name} label far end outside bounds`).toBe(true);
      const half = fakeCtx.measure(n.label.text, fakeCtx.fontSize).height / 2;
      for (const s of [-1, 1]) {
        expect(inside(far.x - s * half * Math.sin(th), far.y + s * half * Math.cos(th)), `${n.name} label corner`).toBe(true);
      }
    }
    // the labels, not just the dots, define the extent: bounds are wider than the dots alone
    const dots = unionRects(rr.nodes.map((n) => shapeRect(n.shape)));
    expect(b.w).toBeGreaterThan(dots.w + 20);
    expect(b.h).toBeGreaterThan(dots.h + 20);
  });
  it('empty tree gives empty result', () => {
    const rr = radial.run({ roots: [] }, opts(), fakeCtx);
    expect(rr.nodes).toEqual([]);
  });
});
