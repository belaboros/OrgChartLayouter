import { describe, it, expect } from 'vitest';
import { parseTeams } from '../../src/model/parse';
import { nestedRects, ASPECTS } from '../../src/layouts/nested-rects';
import { resolveOptions } from '../../src/plugins/options';
import { boxFor, fitLabel, BOX_PAD_X } from '../../src/layouts/label';
import { fakeCtx } from '../helpers/fake-measure';
import { loadTree } from '../helpers/trees';
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
  it('fit: wraps in YAML order into rows with unequal widths; rows are padding apart', () => {
    // widths 64,22,28,22 (h 20), padding 5: target 69.5 -> rows [aaaaaaaa] [b cc] [d]
    const t = parseTeams('Parent:\n  aaaaaaaa:\n  b:\n  cc:\n  d:\n').tree;
    const r = run({ padding: 5 }, t);
    const p = rect(r, 'Parent');
    const [a, b, cc, d] = ['aaaaaaaa', 'b', 'cc', 'd'].map((n) => rect(r, n));
    const x0 = p.x + 5;
    const y0 = p.y + 5 + titleH;
    expect([a.x, a.y]).toEqual([x0, y0]);
    expect([b.x, b.y]).toEqual([x0, y0 + 20 + 5]);
    expect([cc.x, cc.y]).toEqual([x0 + 22 + 5, y0 + 25]);
    expect([d.x, d.y]).toEqual([x0, y0 + 50]);
    // widest row (64) beats the label (Parent = 52) -> w = 64 + 2*5; h = title + 3 rows + 2 gaps + 2*5
    expect(p.w).toBe(74);
    expect(p.h).toBe(titleH + 60 + 10 + 10);
  });
  it('fit: a label wider than the content widens the parent', () => {
    const t = parseTeams('AVeryLongParentLabel:\n  a:\n').tree;
    const p = rect(run({ padding: 5 }, t), 'AVeryLongParentLabel');
    expect(p.w).toBe(boxFor('AVeryLongParentLabel', fakeCtx).w + 10);
  });
  it('fit: rows are top-aligned when a sub-parent sits next to a shorter leaf', () => {
    // S (30x72: two stacked leaves) then leaf lf (28x20) share a row at padding 4
    const t = parseTeams('Top:\n  S:\n    x:\n    y:\n  lf:\n').tree;
    const r = run({ padding: 4 }, t);
    const S = rect(r, 'S');
    const lf = rect(r, 'lf');
    expect([S.w, S.h]).toEqual([30, 72]);
    expect([lf.w, lf.h]).toEqual([28, 20]);
    expect(lf.y).toBe(S.y);
    expect(lf.x).toBe(S.x + S.w + 4);
    const top = rect(r, 'Top');
    expect([S.x - top.x, S.y - top.y]).toEqual([4, 4 + titleH]);
    expect([top.w, top.h]).toEqual([30 + 4 + 28 + 8, titleH + 72 + 8]);
  });
  it('fit: top-level teams share a row padding apart, from the origin', () => {
    const r = run({ padding: 4 });
    const p1 = rect(r, 'P1');
    const p2 = rect(r, 'P2');
    expect([p1.x, p1.y, p1.w, p1.h]).toEqual([0, 0, 56, 72]);
    expect([p2.x, p2.y]).toEqual([p1.x + p1.w + 4, 0]);
  });
  it('fit: top-level teams break into a new row', () => {
    const flat = parseTeams('a:\nb:\nc:\nd:\n').tree;
    const r = run({ padding: 4 }, flat);
    expect([rect(r, 'a').x, rect(r, 'a').y]).toEqual([0, 0]);
    expect([rect(r, 'b').x, rect(r, 'b').y]).toEqual([26, 0]);
    expect([rect(r, 'c').x, rect(r, 'c').y]).toEqual([0, 24]);
    expect([rect(r, 'd').x, rect(r, 'd').y]).toEqual([26, 24]);
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
  it('treemap: a parent label that does not fit is truncated by fitLabel', () => {
    const name = 'Averyveryverylongparentname';
    const r = run({ sizing: 'equal', padding: 0 }, parseTeams(`${name}:\n  x:\n`).tree);
    const expected = fitLabel(name, Math.max(0, rect(r, name).w - 2 * BOX_PAD_X), fakeCtx);
    expect(expected.endsWith('…')).toBe(true);
    expect(node(r, name).label.text).toBe(expected);
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
  it('fit: overall ratio is ordered by aspect (flat teams)', () => {
    const flat = parseTeams(Array.from({ length: 100 }, (_, i) => `t${i}:`).join('\n') + '\n').tree;
    const ratio = (a: string) => {
      const b = run({ aspect: a, padding: 4 }, flat).bounds;
      return b.w / b.h;
    };
    const rs = ['16:9', '4:3', '1:1', 'A4'].map(ratio);
    expect(rs[0]).toBeGreaterThan(rs[1]);
    expect(rs[1]).toBeGreaterThan(rs[2]);
    expect(rs[2]).toBeGreaterThan(rs[3]);
  });
  it('fit: a parent wraps its children differently per aspect', () => {
    const t = parseTeams('P:\n' + 'abcdef'.split('').map((c) => `  ${c}:\n`).join('')).tree;
    const wide = rect(run({ aspect: '16:9', padding: 4 }, t), 'P');
    const tall = rect(run({ aspect: 'A4', padding: 4 }, t), 'P');
    expect(wide.w / wide.h).toBeGreaterThan(tall.w / tall.h);
  });
  it.each(['leaf-count', 'equal'])('%s with heavy padding: every child lies in its parent inner box', (sizing) => {
    for (const file of ['tests/fixtures/chain40.teams.yaml', 'src/samples/medium.teams.yaml']) {
      const r = run({ sizing, padding: 40 }, loadTree(file));
      const byId = new Map(r.nodes.map((n) => [n.id, n]));
      for (const n of r.nodes) {
        if (!n.parentId) continue;
        const p = byId.get(n.parentId)!.shape as Rect;
        const c = n.shape as Rect;
        const ix = Math.min(p.x + 40, p.x + p.w);
        const iy = Math.min(p.y + 40 + titleH, p.y + p.h);
        const iw = Math.max(0, Math.min(p.w - 80, p.x + p.w - ix));
        const ih = Math.max(0, Math.min(p.h - 80 - titleH, p.y + p.h - iy));
        const msg = `${file} ${n.name}`;
        expect(c.x, msg).toBeGreaterThanOrEqual(ix - 0.5);
        expect(c.y, msg).toBeGreaterThanOrEqual(iy - 0.5);
        expect(c.x + c.w, msg).toBeLessThanOrEqual(ix + iw + 0.5);
        expect(c.y + c.h, msg).toBeLessThanOrEqual(iy + ih + 0.5);
      }
    }
  });
});
