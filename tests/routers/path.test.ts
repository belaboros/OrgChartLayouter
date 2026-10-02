import { describe, it, expect } from 'vitest';
import { polylinePath, routeOrientation } from '../../src/routers/path';
import { parsePath } from '../helpers/svg-path';
import type { AnchorPoint } from '../../src/plugins/types';

const P = (x: number, y: number) => ({ x, y });
const A = (x: number, y: number, side: AnchorPoint['side']): AnchorPoint => ({ x, y, side });

describe('polylinePath', () => {
  it('plain polyline', () =>
    expect(polylinePath([P(0, 0), P(0, 10), P(10, 10)], 0)).toBe('M0 0 L0 10 L10 10'));
  it('rounded corner uses Q at the corner', () => {
    const segs = parsePath(polylinePath([P(0, 0), P(0, 10), P(10, 10)], 4));
    expect(segs.map((s) => s.cmd)).toEqual(['M', 'L', 'Q', 'L']);
    expect(segs[1].pts).toEqual([P(0, 6)]);
    expect(segs[2].pts).toEqual([P(0, 10), P(4, 10)]);
    expect(segs[3].pts).toEqual([P(10, 10)]);
  });
  it('radius clamps to half the shorter segment', () =>
    expect(polylinePath([P(0, 0), P(0, 2), P(10, 2)], 8)).toContain('L0 1'));
  it('clamps by the shorter segment even when it is the outgoing one', () =>
    expect(polylinePath([P(0, 0), P(10, 0), P(10, 2)], 8)).toBe('M0 0 L9 0 Q10 0 10 1 L10 2'));
  it('drops repeated points', () =>
    expect(polylinePath([P(0, 0), P(0, 0), P(0, 10), P(0, 10)], 0)).toBe('M0 0 L0 10'));
  it('formats up to 3 decimals without trailing zeros, negatives included', () =>
    expect(polylinePath([P(-1.5, 0), P(33.33333, 12.5)], 0)).toBe('M-1.5 0 L33.333 12.5'));
  it('single point yields only M', () => expect(polylinePath([P(3, 4)], 2)).toBe('M3 4'));
});

describe('parsePath', () => {
  it('parses negatives and decimals', () =>
    expect(parsePath('M-1.5 0 L33.333 -12.5 Q1 2 3 4')).toEqual([
      { cmd: 'M', pts: [P(-1.5, 0)] },
      { cmd: 'L', pts: [P(33.333, -12.5)] },
      { cmd: 'Q', pts: [P(1, 2), P(3, 4)] },
    ]));
});

describe('routeOrientation', () => {
  it('top/bottom is vertical, left/right horizontal, whatever the direction', () => {
    expect(routeOrientation(A(0, 0, 'bottom'), A(100, 1, 'top'), 'right')).toBe('vertical');
    expect(routeOrientation(A(0, 0, 'top'), A(1, 100, 'top'), 'right')).toBe('vertical');
    expect(routeOrientation(A(0, 0, 'right'), A(1, 100, 'left'), 'down')).toBe('horizontal');
    expect(routeOrientation(A(0, 0, 'left'), A(1, 100, 'left'), 'down')).toBe('horizontal');
  });
  it('center/boundary: down vertical, right horizontal', () => {
    expect(routeOrientation(A(0, 0, 'center'), A(100, 1, 'center'), 'down')).toBe('vertical');
    expect(routeOrientation(A(0, 0, 'boundary'), A(1, 100, 'boundary'), 'right')).toBe('horizontal');
  });
  it('center/boundary otherwise: larger delta, vertical on a tie', () => {
    expect(routeOrientation(A(0, 0, 'center'), A(100, 10, 'center'), 'outward')).toBe('horizontal');
    expect(routeOrientation(A(0, 0, 'center'), A(10, -100, 'boundary'), 'none')).toBe('vertical');
    expect(routeOrientation(A(0, 0, 'center'), A(10, 10, 'center'), 'outward')).toBe('vertical');
  });
});
