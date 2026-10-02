import { describe, it, expect } from 'vitest';
import { boxFor, fitLabel, labelExtent } from '../../src/layouts/label';
import type { PlacedNode } from '../../src/plugins/types';
import { fakeCtx } from '../helpers/fake-measure';

describe('label', () => {
  it('boxFor adds padding', () => expect(boxFor('abcd', fakeCtx)).toEqual({ w: 24 + 16, h: 12 + 8 }));
  it('fitLabel keeps text that fits', () => expect(fitLabel('abcd', 24, fakeCtx)).toBe('abcd'));
  it('fitLabel truncates with an ellipsis', () => expect(fitLabel('abcdefgh', 30, fakeCtx)).toBe('abcd…'));
  it('fitLabel handles an 80-char name in a tiny box', () => expect(fitLabel('x'.repeat(80), 3, fakeCtx)).toBe(''));

  const node = (shape: PlacedNode['shape'], label: PlacedNode['label']): PlacedNode =>
    ({ id: 'a', name: 'a', depth: 1, parentId: null, hiddenDescendants: 0, stacked: false, shape, label });
  it('labelExtent of a rect or circle shape is the shape rect', () => {
    expect(labelExtent(node({ kind: 'rect', x: 1, y: 2, w: 30, h: 20 }, { text: 'abcdefghijk', x: 16, y: 12, anchor: 'middle', rotate: 0 }), fakeCtx))
      .toEqual({ x: 1, y: 2, w: 30, h: 20 });
    expect(labelExtent(node({ kind: 'circle', cx: 10, cy: 10, r: 5 }, { text: 'abcdefghijk', x: 10, y: 10, anchor: 'middle', rotate: 0 }), fakeCtx))
      .toEqual({ x: 5, y: 5, w: 10, h: 10 });
  });
  it('labelExtent of a dot label runs outward along the ray (start anchor, +x)', () => {
    // 'abcd' -> 24 px wide, 12 px tall; ray along +x from (108, 0)
    const r = labelExtent(node({ kind: 'dot', cx: 100, cy: 0, r: 4 }, { text: 'abcd', x: 108, y: 0, anchor: 'start', rotate: 0 }), fakeCtx);
    expect(r.x).toBeCloseTo(108, 6);
    expect(r.w).toBeCloseTo(24, 6);
    expect(r.y).toBeCloseTo(-6, 6);
    expect(r.h).toBeCloseTo(12, 6);
  });
  it('labelExtent of a dot label on the left runs outward to -x (end anchor)', () => {
    const r = labelExtent(node({ kind: 'dot', cx: -100, cy: 0, r: 4 }, { text: 'abcdef', x: -108, y: 0, anchor: 'end', rotate: 0 }), fakeCtx);
    expect(r.x).toBeCloseTo(-108 - 36, 6);
    expect(r.w).toBeCloseTo(36, 6);
  });
  it('labelExtent of a dot label on a vertical ray runs along +y', () => {
    const r = labelExtent(node({ kind: 'dot', cx: 0, cy: 50, r: 4 }, { text: 'ab', x: 0, y: 58, anchor: 'start', rotate: 90 }), fakeCtx);
    expect(r.x).toBeCloseTo(-6, 6);
    expect(r.w).toBeCloseTo(12, 6);
    expect(r.y).toBeCloseTo(58, 6);
    expect(r.h).toBeCloseTo(12, 6);
  });
});
