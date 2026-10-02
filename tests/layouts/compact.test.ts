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
});
