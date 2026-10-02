import { describe, it, expect } from 'vitest';
import { parseTeams } from '../../src/model/parse';
import { nestedCircles } from '../../src/layouts/nested-circles';
import { resolveOptions } from '../../src/plugins/options';
import { boxFor, fitLabel } from '../../src/layouts/label';
import { fakeCtx } from '../helpers/fake-measure';
import { loadTree } from '../helpers/trees';
import type { NodeLayoutResult, Options } from '../../src/plugins/types';

type C = { kind: string; cx: number; cy: number; r: number };
const run = (src: string | ReturnType<typeof loadTree>, o: Options = {}) =>
  nestedCircles.run(typeof src === 'string' ? parseTeams(src).tree : src, resolveOptions(nestedCircles.optionsSchema, o), fakeCtx);
const node = (r: NodeLayoutResult, name: string) => r.nodes.find((n) => n.name === name)!;
const circ = (r: NodeLayoutResult, name: string) => node(r, name).shape as C;
const titleH = boxFor('X', fakeCtx).h;
const dist = (a: C, b: C) => Math.hypot(a.cx - b.cx, a.cy - b.cy);

describe('nested-circles', () => {
  it('declares id, options, no edges', () => {
    const r = run('A:\n  b:\n');
    expect([nestedCircles.id, r.hasEdges, r.direction]).toEqual(['nested-circles', false, 'none']);
    expect(resolveOptions(nestedCircles.optionsSchema, {})).toEqual({ sizing: 'fit', padding: 6 });
    expect(r.nodes.every((n) => n.shape.kind === 'circle')).toBe(true);
  });
  it('fit: leaf radius = half label width + padding', () => {
    expect(circ(run('P:\n  abcd:\n'), 'abcd').r).toBeCloseTo(24 / 2 + 6);
    expect(circ(run('P:\n  abcd:\n', { padding: 10 }), 'abcd').r).toBeCloseTo(24 / 2 + 10);
  });
  it('fit: unequal leaves scale with label width', () => {
    const r = run('P:\n  ab:\n  abcdefgh:\n');
    expect(circ(r, 'ab').r).toBeCloseTo(6 + 6);
    expect(circ(r, 'abcdefgh').r).toBeCloseTo(24 + 6);
  });
  it('fit: parent radius = enclosing radius + padding + titleH, children shifted down by titleH/2', () => {
    const r = run('P:\n  ab:\n  abcdefgh:\n');
    const [p, a, b] = [circ(r, 'P'), circ(r, 'ab'), circ(r, 'abcdefgh')];
    // two touching circles of radii 12 and 30: enclosure radius (12+30+12... ) = 42 -> r = 42 + 6 + titleH
    expect(p.r).toBeCloseTo(42 + 6 + titleH);
    expect(dist(a, b)).toBeCloseTo(a.r + b.r);
    // both children share a row, titleH/2 below the parent centre
    expect(Math.abs(a.cy - b.cy)).toBeLessThan(1e-6);
    expect(a.cy - p.cy).toBeCloseTo(titleH / 2);
    // outermost extent of children reaches exactly the inner boundary
    expect(Math.min(a.cx - a.r, b.cx - b.r)).toBeCloseTo(p.cx - 42);
  });
  it('fit: single child sits at parent centre + titleH/2 down', () => {
    const r = run('P:\n  abcd:\n');
    expect(circ(r, 'abcd').cx).toBeCloseTo(circ(r, 'P').cx);
    expect(circ(r, 'abcd').cy - circ(r, 'P').cy).toBeCloseTo(titleH / 2);
    expect(circ(r, 'P').r).toBeCloseTo(12 + 6 + 6 + titleH);
  });
  it('leaf-count: every leaf has the same radius', () => {
    const r = run(loadTree('src/samples/medium.teams.yaml'), { sizing: 'leaf-count' });
    const radii = r.nodes.filter((n) => !r.nodes.some((m) => m.parentId === n.id)).map((n) => (n.shape as C).r);
    expect(radii.length).toBeGreaterThan(3);
    radii.forEach((x) => expect(x).toBeCloseTo(radii[0], 3));
  });
  it('equal: leaves of a small branch are larger than leaves of a big branch', () => {
    const r = run('A:\n  a1:\n  a2:\nB:\n  b1:\n  b2:\n  b3:\n  b4:\n', { sizing: 'equal' });
    expect(circ(r, 'a1').r).toBeGreaterThan(circ(r, 'b1').r);
    expect(circ(r, 'a1').r).toBeCloseTo(circ(r, 'a2').r);
  });
  it('leaf-count: bigger branch gets bigger circle', () => {
    const r = run('A:\n  a1:\nB:\n  b1:\n  b2:\n  b3:\n', { sizing: 'leaf-count' });
    expect(circ(r, 'B').r).toBeGreaterThan(circ(r, 'A').r);
  });
  it('node metadata mirrors the tree', () => {
    for (const sizing of ['fit', 'leaf-count']) {
      const r = run('P1:\n  a:\n  b:\nP2:\n', { sizing });
      expect(node(r, 'P1')).toMatchObject({ depth: 1, parentId: null, stacked: false });
      expect(node(r, 'a')).toMatchObject({ depth: 2, parentId: node(r, 'P1').id });
      expect(node(r, 'P2')).toMatchObject({ depth: 1, parentId: null });
    }
  });
  it('labels: parent near the top, leaf centred', () => {
    for (const sizing of ['fit', 'leaf-count']) {
      const r = run('Parent:\n  a:\n  b:\n', { sizing });
      const p = circ(r, 'Parent');
      expect(node(r, 'Parent').label).toMatchObject({ x: p.cx, y: p.cy - p.r + 6 + titleH / 2, anchor: 'middle' });
      const a = circ(r, 'a');
      expect(node(r, 'a').label).toMatchObject({ x: a.cx, y: a.cy, anchor: 'middle' });
    }
  });
  it('labels are truncated to 2r - 2 padding', () => {
    const r = run('P:\n  averyveryverylongname:\n', { sizing: 'leaf-count', padding: 6 });
    const n = circ(r, 'P');
    const t = node(r, 'P').label.text;
    expect(t).toBe(fitLabel('P', Math.max(0, 2 * n.r - 12), fakeCtx));
    const leaf = node(r, 'averyveryverylongname');
    expect(leaf.label.text).toBe(fitLabel(leaf.name, Math.max(0, 2 * (leaf.shape as C).r - 12), fakeCtx));
  });
  it('bounds start at the origin', () => {
    for (const sizing of ['fit', 'leaf-count']) {
      const r = run(loadTree('src/samples/small.teams.yaml'), { sizing });
      expect(r.bounds.x).toBeCloseTo(0);
      expect(r.bounds.y).toBeCloseTo(0);
    }
  });
  it('empty tree yields no nodes', () => {
    expect(run('').nodes).toEqual([]);
  });
});
