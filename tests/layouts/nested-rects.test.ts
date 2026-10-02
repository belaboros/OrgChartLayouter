import { describe, it, expect } from 'vitest';
import { parseTeams } from '../../src/model/parse';
import { nestedRects, ASPECTS } from '../../src/layouts/nested-rects';
import { resolveOptions } from '../../src/plugins/options';
import { boxFor, BOX_PAD_X } from '../../src/layouts/label';
import { fakeCtx } from '../helpers/fake-measure';
import type { NodeLayoutResult, Options, Rect } from '../../src/plugins/types';

const tree = parseTeams('P1:\n  a:\n  b:\n  c:\nP2:\n  d:\n').tree;
const run = (o: Options, t = tree) => nestedRects.run(t, resolveOptions(nestedRects.optionsSchema, o), fakeCtx);
const node = (r: NodeLayoutResult, name: string) => r.nodes.find((n) => n.name === name)!;
const rect = (r: NodeLayoutResult, name: string) => node(r, name).shape as Rect;
const area = (r: NodeLayoutResult, name: string) => rect(r, name).w * rect(r, name).h;
const titleH = boxFor('X', fakeCtx).h;

describe('nested-rects', () => {
  it('no edges, direction none', () => expect([run({}).hasEdges, run({}).direction]).toEqual([false, 'none']));
  it('declares its options and aspects', () => {
    expect(nestedRects.id).toBe('nested-rects');
    expect(resolveOptions(nestedRects.optionsSchema, {})).toEqual({ sizing: 'fit', padding: 8, aspect: '16:9' });
    expect(ASPECTS).toEqual({ '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, A4: 1 / Math.SQRT2 });
  });
  it('fit: leaf size equals boxFor', () => {
    const s = rect(run({}), 'a');
    expect([s.w, s.h]).toEqual([boxFor('a', fakeCtx).w, boxFor('a', fakeCtx).h]);
  });
  it('fit: node metadata mirrors the tree', () => {
    const r = run({});
    expect(node(r, 'P1')).toMatchObject({ depth: 1, parentId: null, stacked: false });
    expect(node(r, 'a')).toMatchObject({ depth: 2, parentId: node(r, 'P1').id });
  });
  it('fit: exact geometry of a parent with three leaves', () => {
    const r = run({ padding: 4 });
    const { w, h } = boxFor('a', fakeCtx);
    const [p1, a, b, c] = ['P1', 'a', 'b', 'c'].map((n) => rect(r, n));
    // target row width sqrt(3*w*h*16/9) ~ 48.5 fits two leaves (2w+4 = 48) -> rows [a b] / [c]
    expect([a.x - p1.x, a.y - p1.y]).toEqual([4, 4 + titleH]);
    expect([b.x - a.x, b.y]).toEqual([w + 4, a.y]);
    expect([c.x, c.y]).toEqual([a.x, a.y + h + 4]);
    expect(p1.h).toBeCloseTo(titleH + 2 * h + 4 + 8);
    expect(p1.w).toBeCloseTo(2 * w + 4 + 8);
  });
  it('fit: long parent label widens the parent; wide row wraps children top-aligned', () => {
    const t = parseTeams('Parent:\n  aaaaaaaaaaaaaaaa:\n  b:\n  cc:\n  d:\n').tree;
    const r = run({ padding: 5 }, t);
    const rows = new Set(['aaaaaaaaaaaaaaaa', 'b', 'cc', 'd'].map((n) => rect(r, n).y));
    expect(rows.size).toBeGreaterThan(1);
    const b = rect(r, 'b');
    const cc = rect(r, 'cc');
    if (b.y === cc.y) expect(cc.x - (b.x + b.w)).toBe(5);
    const p = rect(r, 'Parent');
    expect(p.w).toBeGreaterThanOrEqual(boxFor('Parent', fakeCtx).w + 10);
  });
  it('fit: top-level teams wrap from origin 0,0 with no outer padding', () => {
    const r = run({ padding: 8 });
    expect(Math.min(...r.nodes.map((n) => (n.shape as Rect).x))).toBe(0);
    expect(Math.min(...r.nodes.map((n) => (n.shape as Rect).y))).toBe(0);
    expect(rect(r, 'P1').x).toBe(0);
  });
  it('parent label: start-anchored in the title strip, leaf label centred', () => {
    const r = run({ padding: 6 });
    const p = rect(r, 'P1');
    expect(node(r, 'P1').label).toMatchObject({ x: p.x + 6 + BOX_PAD_X, y: p.y + 6 + titleH / 2, anchor: 'start', text: 'P1' });
    const a = rect(r, 'a');
    expect(node(r, 'a').label).toMatchObject({ x: a.x + a.w / 2, y: a.y + a.h / 2, anchor: 'middle' });
  });
  it('treemap: truncates a label that does not fit', () => {
    const t = parseTeams('Averyveryverylongparentname:\n  x:\n').tree;
    const r = run({ sizing: 'equal', padding: 0 }, t);
    const p = rect(r, 'Averyveryverylongparentname');
    const text = node(r, 'Averyveryverylongparentname').label.text;
    expect(text.length * 6 + 2 * BOX_PAD_X <= Math.max(p.w, 0) || text.endsWith('…') || text === '').toBe(true);
  });
  it('leaf-count: sibling areas follow leaf counts (padding 0)', () => {
    const r = run({ sizing: 'leaf-count', padding: 0 });
    expect(area(r, 'P1') / area(r, 'P2')).toBeCloseTo(3, 1);
  });
  it('equal: sibling areas are equal (padding 0)', () => {
    const r = run({ sizing: 'equal', padding: 0 });
    expect(area(r, 'P1') / area(r, 'P2')).toBeCloseTo(1, 1);
  });
  it('equal: children split their parent weight evenly', () => {
    const r = run({ sizing: 'equal', padding: 0 });
    expect(area(r, 'a') / area(r, 'd')).toBeCloseTo(1 / 3, 1);
    expect(area(r, 'a') / area(r, 'b')).toBeCloseTo(1, 1);
  });
  it('treemap: parent leaves a title strip above its children', () => {
    const r = run({ sizing: 'leaf-count', padding: 5 });
    const p = rect(r, 'P1');
    const top = Math.min(...['a', 'b', 'c'].map((n) => rect(r, n).y));
    expect(top - p.y).toBeCloseTo(titleH + 5, 5);
  });
  it('treemap: top-level teams are padded inside the root', () => {
    const r = run({ sizing: 'leaf-count', padding: 5 });
    expect(Math.min(...r.nodes.map((n) => (n.shape as Rect).x))).toBeCloseTo(5);
  });
  it.each(['16:9', '4:3', '1:1', 'A4'])('treemap bounds follow aspect %s', (a) => {
    const b = run({ sizing: 'leaf-count', aspect: a, padding: 0 }).bounds;
    expect(b.w / b.h).toBeCloseTo(ASPECTS[a], 2);
  });
  it.each(['16:9', 'A4'])('fit: overall shape leans toward aspect %s', (a) => {
    const flat = parseTeams(Array.from({ length: 30 }, (_, i) => `t${i}:`).join('\n') + '\n').tree;
    const b = run({ aspect: a, padding: 4 }, flat).bounds;
    const ratio = b.w / b.h;
    expect(Math.abs(Math.log(ratio / ASPECTS[a]))).toBeLessThan(Math.log(2));
  });
});
