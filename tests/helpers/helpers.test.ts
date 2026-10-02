import { describe, it, expect } from 'vitest';
import { contains, overlaps } from './geometry';
import { optionVariants } from './variants';
import type { Shape } from '../../src/plugins/types';

const r = (x: number, y: number, w: number, h: number): Shape => ({ kind: 'rect', x, y, w, h });
const c = (cx: number, cy: number, rad: number, kind: 'circle' | 'dot' = 'circle'): Shape => ({ kind, cx, cy, r: rad });

describe('geometry helpers', () => {
  it('rect overlap respects eps', () => {
    expect(overlaps(r(0, 0, 10, 10), r(9, 0, 10, 10))).toBe(true);
    expect(overlaps(r(0, 0, 10, 10), r(10, 0, 10, 10))).toBe(false);
    expect(overlaps(r(0, 0, 10, 10), r(9.8, 0, 10, 10))).toBe(false);
  });
  it('circle and dot overlap alike; mixed kinds throw', () => {
    expect(overlaps(c(0, 0, 5), c(8, 0, 5, 'dot'))).toBe(true);
    expect(overlaps(c(0, 0, 5), c(10, 0, 5, 'dot'))).toBe(false);
    expect(() => overlaps(r(0, 0, 1, 1), c(0, 0, 1))).toThrow();
  });
  it('contains', () => {
    expect(contains(c(0, 0, 10), c(4, 0, 6, 'dot'))).toBe(true);
    expect(contains(c(0, 0, 10), c(6, 0, 6))).toBe(false);
    expect(contains(r(0, 0, 10, 10), c(5, 5, 5))).toBe(true);
    expect(contains(r(0, 0, 10, 10), r(1, 1, 10, 10))).toBe(false);
    expect(() => contains(c(0, 0, 10), r(0, 0, 1, 1))).toThrow();
  });
});

describe('optionVariants', () => {
  it('changes one key at a time', () => {
    const v = optionVariants([
      { key: 'n', label: 'n', type: 'number', min: 0, max: 5, step: 1, default: 2 },
      { key: 's', label: 's', type: 'select', choices: [{ value: 'a', label: 'a' }, { value: 'b', label: 'b' }], default: 'a' },
      { key: 'b', label: 'b', type: 'boolean', default: true },
    ]);
    expect(v).toEqual([
      { n: 2, s: 'a', b: true },
      { n: 0, s: 'a', b: true },
      { n: 5, s: 'a', b: true },
      { n: 2, s: 'b', b: true },
      { n: 2, s: 'a', b: false },
    ]);
  });
});
