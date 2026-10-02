import { describe, it, expect } from 'vitest';
import { parseTeams } from '../../src/model/parse';
import { topDown } from '../../src/layouts/top-down';
import { resolveOptions } from '../../src/plugins/options';
import { boxFor } from '../../src/layouts/label';
import { fakeCtx } from '../helpers/fake-measure';
import type { Rect } from '../../src/plugins/types';

const tree = parseTeams('A:\n  B:\n  C:\n  D:\nE:\n').tree;
const r = topDown.run(tree, resolveOptions(topDown.optionsSchema), fakeCtx);
const at = (name: string) => r.nodes.find((n) => n.name === name)!.shape as Rect & { kind: 'rect' };

describe('topDown', () => {
  it('direction down, has edges, no origin', () => expect([r.direction, r.hasEdges, r.origin]).toEqual(['down', true, null]));
  it('children are one level gap below the parent', () =>
    expect(at('B').y).toBeGreaterThanOrEqual(at('A').y + at('A').h + 40 - 0.01));
  it('siblings keep YAML order left to right', () => expect(at('B').x < at('C').x && at('C').x < at('D').x).toBe(true));
  it('parent centred over its children', () =>
    expect(at('A').x + at('A').w / 2).toBeCloseTo(at('C').x + at('C').w / 2, 1));
  it('top-level teams share one row', () => expect(at('A').y).toBeCloseTo(at('E').y));
  it('rect size comes from boxFor', () =>
    expect([at('B').w, at('B').h]).toEqual([boxFor('B', fakeCtx).w, boxFor('B', fakeCtx).h]));
  it('option schema', () =>
    expect(topDown.optionsSchema.map((o) => [o.key, o.type === 'number' ? [o.min, o.max, o.step, o.default] : null])).toEqual([
      ['siblingGap', [0, 80, 1, 16]],
      ['levelGap', [10, 150, 1, 40]],
    ]));
  it('label is centred in the box', () => {
    const n = r.nodes.find((x) => x.name === 'B')!;
    const s = at('B');
    expect(n.label).toEqual({ text: 'B', x: s.x + s.w / 2, y: s.y + s.h / 2, anchor: 'middle', rotate: 0 });
  });
  it('empty tree gives empty result', () => {
    const e = topDown.run({ roots: [] }, resolveOptions(topDown.optionsSchema), fakeCtx);
    expect(e.nodes).toEqual([]);
  });
});
