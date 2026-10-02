import { describe, it, expect } from 'vitest';
import { parseTeams } from '../../src/model/parse';
import { compact } from '../../src/layouts/compact';
import { resolveOptions } from '../../src/plugins/options';
import { shapeCenter } from '../../src/geometry/rect';
import { fakeCtx } from '../helpers/fake-measure';
import type { PlacedNode, Rect } from '../../src/plugins/types';

const leaves = (n: number) => Array.from({ length: n }, (_, i) => `    L${i}:`).join('\n');
const tree = parseTeams(`A:\n  B:\n${leaves(10)}\n  C:\n`).tree;
const r = compact.run(tree, resolveOptions(compact.optionsSchema), fakeCtx);
const node = (name: string) => r.nodes.find((n) => n.name === name)!;
const cx = (n: PlacedNode) => shapeCenter(n.shape).x;

describe('compact', () => {
  it('stacks an all-leaf group into ceil(10/8)=2 columns, one each side of the trunk', () => {
    const ls = r.nodes.filter((n) => n.name.startsWith('L'));
    expect(ls.every((n) => n.stacked)).toBe(true);
    const left = ls.filter((n) => cx(n) < cx(node('B'))), right = ls.filter((n) => cx(n) > cx(node('B')));
    expect([left.length, right.length]).toEqual([5, 5]);
    expect(new Set(left.map((n) => (n.shape as Rect).x)).size).toBe(1);
  });
  it('mixed groups are not stacked', () => expect([node('B').stacked, node('C').stacked]).toEqual([false, false]));
  it('leaves fill columns left to right, top to bottom', () => {
    const [l0, l5] = [node('L0'), node('L5')];
    expect(cx(l0)).toBeLessThan(cx(node('B'))); expect(cx(l5)).toBeGreaterThan(cx(node('B')));
    expect((node('L1').shape as Rect).y).toBeGreaterThan((l0.shape as Rect).y);
  });
  it('a single-column group sits right of the trunk', () => {
    const r1 = compact.run(parseTeams('A:\n  X:\n  Y:\n').tree, resolveOptions(compact.optionsSchema), fakeCtx);
    const a = r1.nodes.find((n) => n.name === 'A')!;
    expect(r1.nodes.filter((n) => n.stacked).every((n) => (n.shape as Rect).x > shapeCenter(a.shape).x)).toBe(true);
  });
  it('balances column sizes: 9 leaves, 2 columns -> 5 and 4', () => {
    const t = parseTeams(`A:\n${leaves(9).replace(/    /g, '  ')}\n`).tree;
    const res = compact.run(t, resolveOptions(compact.optionsSchema), fakeCtx);
    const xs = new Map<number, number>();
    res.nodes.filter((n) => n.stacked).forEach((n) => xs.set((n.shape as Rect).x, (xs.get((n.shape as Rect).x) ?? 0) + 1));
    expect([...xs.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1])).toEqual([5, 4]);
  });
  it('option schema', () =>
    expect(compact.optionsSchema.map((o) => o.key)).toEqual(['siblingGap', 'levelGap', 'maxPerColumn']));

  describe('stacked geometry', () => {
    const SG = 16, LG = 40;
    const rect = (n: PlacedNode) => n.shape as Rect;
    const names = ['a', 'bbbbbbbbbb', 'cc', 'dddddd', 'e', 'ffffffffff', 'gg'];
    const run = (count: number, perCol: number) => {
      const t = parseTeams(`P:\n${names.slice(0, count).map((x) => `  ${x}:`).join('\n')}\n`).tree;
      const res = compact.run(t, { ...resolveOptions(compact.optionsSchema), maxPerColumn: perCol }, fakeCtx);
      const parent = res.nodes.find((n) => n.name === 'P')!;
      const kids = res.nodes.filter((n) => n.name !== 'P');
      const byX = new Map<number, PlacedNode[]>();
      kids.forEach((n) => byX.set(rect(n).x, [...(byX.get(rect(n).x) ?? []), n]));
      const cols = [...byX.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
      return { parent, trunk: cx(parent), cols };
    };
    const right = (col: PlacedNode[]) => Math.max(...col.map((n) => rect(n).x + rect(n).w));

    it('k=4: two columns each side, nearest columns keep siblingGap from the trunk, columns siblingGap apart', () => {
      const { trunk, cols } = run(7, 2);
      expect(cols.length).toBe(4);
      expect(cols.map((c) => c.length)).toEqual([2, 2, 2, 1]);
      expect(cols.map((c) => c.map((n) => n.name))).toEqual([['a', 'bbbbbbbbbb'], ['cc', 'dddddd'], ['e', 'ffffffffff'], ['gg']]);
      expect(right(cols[1])).toBeCloseTo(trunk - SG);
      expect(rect(cols[2][0]).x).toBeCloseTo(trunk + SG);
      expect(rect(cols[1][0]).x - right(cols[0])).toBeCloseTo(SG);
      expect(rect(cols[3][0]).x - right(cols[2])).toBeCloseTo(SG);
    });
    it('k=3: floor(3/2)=1 column on the left, 2 on the right', () => {
      const { trunk, cols } = run(5, 2);
      expect(cols.length).toBe(3);
      expect(cols.filter((c) => cx(c[0]) < trunk).length).toBe(1);
      expect(right(cols[0])).toBeCloseTo(trunk - SG);
      expect(rect(cols[1][0]).x).toBeCloseTo(trunk + SG);
    });
    it('boxes within a column are left-aligned', () => {
      const { cols } = run(7, 2);
      for (const c of cols) expect(new Set(c.map((n) => rect(n).x)).size).toBe(1);
      expect(rect(cols[0][0]).w).not.toBeCloseTo(rect(cols[0][1]).w);
    });
    it('columns are top-aligned, levelGap below the parent, with siblingGap between rows', () => {
      const { parent, cols } = run(7, 2);
      for (const c of cols) expect(rect(c[0]).y).toBeCloseTo(rect(parent).y + rect(parent).h + LG);
      for (const c of cols.slice(0, 3)) expect(rect(c[1]).y - (rect(c[0]).y + rect(c[0]).h)).toBeCloseTo(SG);
    });
  });
  describe('mixed group geometry', () => {
    const t = parseTeams('P:\n  X:\n    X1:\n  Y:\n  Z:\n    Z1:\n    Z2:\n').tree;
    const res = compact.run(t, resolveOptions(compact.optionsSchema), fakeCtx);
    const nd = (name: string) => res.nodes.find((n) => n.name === name)!;
    const rect = (n: PlacedNode) => n.shape as Rect;
    it('parent is centred between first and last child centres', () =>
      expect(cx(nd('P'))).toBeCloseTo((cx(nd('X')) + cx(nd('Z'))) / 2));
    it('children sit levelGap below the parent', () => {
      for (const c of ['X', 'Y', 'Z']) expect(rect(nd(c)).y).toBeCloseTo(rect(nd('P')).y + rect(nd('P')).h + 40);
    });
  });
});
