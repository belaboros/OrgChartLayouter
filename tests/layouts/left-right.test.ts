import { describe, it, expect } from 'vitest';
import { parseTeams } from '../../src/model/parse';
import { leftRight } from '../../src/layouts/left-right';
import { resolveOptions } from '../../src/plugins/options';
import { boxFor } from '../../src/layouts/label';
import { fakeCtx } from '../helpers/fake-measure';
import type { Rect } from '../../src/plugins/types';

const tree = parseTeams('A:\n  B:\n  C:\n  D:\nE:\n').tree;
const r = leftRight.run(tree, resolveOptions(leftRight.optionsSchema), fakeCtx);
const at = (name: string) => r.nodes.find((n) => n.name === name)!.shape as Rect & { kind: 'rect' };

describe('leftRight', () => {
  it('direction right, has edges, no origin', () => expect([r.direction, r.hasEdges, r.origin]).toEqual(['right', true, null]));
  it('children are one level gap to the right of the parent', () =>
    expect(at('B').x).toBeGreaterThanOrEqual(at('A').x + at('A').w + 40 - 0.01));
  it('siblings keep YAML order top to bottom', () => expect(at('B').y < at('C').y && at('C').y < at('D').y).toBe(true));
  it('parent centred beside its children', () =>
    expect(at('A').y + at('A').h / 2).toBeCloseTo(at('C').y + at('C').h / 2, 1));
  it('top-level teams share one column', () => expect(at('A').x).toBeCloseTo(at('E').x));
  it('rect size comes from boxFor', () =>
    expect([at('B').w, at('B').h]).toEqual([boxFor('B', fakeCtx).w, boxFor('B', fakeCtx).h]));
  it('option schema', () =>
    expect(leftRight.optionsSchema.map((o) => [o.key, o.type === 'number' ? [o.min, o.max, o.step, o.default] : null])).toEqual([
      ['siblingGap', [0, 80, 1, 16]],
      ['levelGap', [10, 150, 1, 40]],
    ]));
  it('label is centred in the box', () => {
    const n = r.nodes.find((x) => x.name === 'B')!;
    const s = at('B');
    expect(n.label).toEqual({ text: 'B', x: s.x + s.w / 2, y: s.y + s.h / 2, anchor: 'middle', rotate: 0 });
  });
  it('empty tree gives empty result', () => {
    const e = leftRight.run({ roots: [] }, resolveOptions(leftRight.optionsSchema), fakeCtx);
    expect(e.nodes).toEqual([]);
  });
});
