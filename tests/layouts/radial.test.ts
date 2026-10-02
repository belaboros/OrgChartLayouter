import { describe, it, expect } from 'vitest';
import { parseTeams } from '../../src/model/parse';
import { radial } from '../../src/layouts/radial';
import { resolveOptions } from '../../src/plugins/options';
import { shapeCenter } from '../../src/geometry/rect';
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
  it('labels are truncated to ringSpacing-12 only when a deeper ring exists', () => {
    const long = 'X'.repeat(40);
    const rr = radial.run(tree(`${long}:\n  ${long}Y:\n`), opts({ ringSpacing: 80 }), fakeCtx);
    const top = rr.nodes.find((n) => n.name === long)!;
    const leaf = rr.nodes.find((n) => n.name === `${long}Y`)!;
    expect(top.label.text.endsWith('…')).toBe(true);
    expect(top.label.text.length * 6).toBeLessThanOrEqual(80 - 12);
    expect(leaf.label.text).toBe(leaf.name);
  });
  it('rings expand so crowded same-depth shapes do not touch (boxes, wrap-around included)', () => {
    const names = Array.from({ length: 30 }, (_, i) => `Team${i}`.padEnd(14, 'x'));
    const t = tree(names.map((n) => `${n}:`).join('\n') + '\n');
    const rr = radial.run(t, opts({ nodeStyle: 'boxes' }), fakeCtx);
    expect(dist(rr.nodes[0])).toBeGreaterThan(80);
    for (let i = 0; i < rr.nodes.length; i++) for (let j = i + 1; j < rr.nodes.length; j++) {
      const a = shapeCenter(rr.nodes[i].shape), b = shapeCenter(rr.nodes[j].shape);
      const ea = Math.hypot((rr.nodes[i].shape as Rect).w, (rr.nodes[i].shape as Rect).h);
      const eb = Math.hypot((rr.nodes[j].shape as Rect).w, (rr.nodes[j].shape as Rect).h);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(ea / 2 + eb / 2 + 4 - 1e-6);
    }
  });
  it('R2: ring gap covers neighbouring max extents in boxes mode', () => {
    const t = tree(`${'W'.repeat(60)}:\n  ${'V'.repeat(60)}:\n`);
    const rr = radial.run(t, opts({ nodeStyle: 'boxes', ringSpacing: 30 }), fakeCtx);
    const ext = (n: PlacedNode) => Math.hypot((n.shape as Rect).w, (n.shape as Rect).h);
    expect(dist(rr.nodes[1]) - dist(rr.nodes[0])).toBeGreaterThanOrEqual((ext(rr.nodes[0]) + ext(rr.nodes[1])) / 2 + 4 - 1e-6);
  });
  it('empty tree gives empty result', () => {
    const rr = radial.run({ roots: [] }, opts(), fakeCtx);
    expect(rr.nodes).toEqual([]);
  });
});
