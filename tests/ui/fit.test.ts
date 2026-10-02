import { describe, it, expect } from 'vitest';
import { fitTransform } from '../../src/ui/fit';

describe('fitTransform', () => {
  it('centres and scales to fit', () =>
    expect(fitTransform({ x: 0, y: 0, w: 960, h: 460 }, { width: 1000, height: 500 })).toEqual({ k: 1, x: 20, y: 20 }));
  it('caps zoom at 2', () =>
    expect(fitTransform({ x: 0, y: 0, w: 10, h: 10 }, { width: 1000, height: 1000 }).k).toBe(2));
  it('scales down by the tighter axis (width limits)', () => {
    const t = fitTransform({ x: 0, y: 0, w: 1960, h: 100 }, { width: 1000, height: 1000 });
    expect(t.k).toBeCloseTo(0.5);
    expect(t.x).toBeCloseTo(10);
    expect(t.y).toBeCloseTo((1000 - 140 * 0.5) / 2 + 20 * 0.5);
  });
  it('scales down by the tighter axis (height limits)', () => {
    const t = fitTransform({ x: 0, y: 0, w: 100, h: 1960 }, { width: 1000, height: 1000 });
    expect(t.k).toBeCloseTo(0.5);
    expect(t.y).toBeCloseTo(10);
    expect(t.x).toBeCloseTo((1000 - 140 * 0.5) / 2 + 20 * 0.5);
  });
  it('accounts for bounds origin and custom margin, centring content', () => {
    const t = fitTransform({ x: -100, y: 50, w: 200, h: 100 }, { width: 400, height: 300 }, 0);
    expect(t.k).toBe(2);
    // content centre (0,100) must map to viewport centre (200,150)
    expect(t.k * 0 + t.x).toBeCloseTo(200);
    expect(t.k * 100 + t.y).toBeCloseTo(150);
  });
  it('honours the margin in the scale', () => {
    expect(fitTransform({ x: 0, y: 0, w: 100, h: 100 }, { width: 200, height: 200 }, 50).k).toBeCloseTo(1);
  });
  it('zero-size bounds do not divide by zero', () => {
    const t = fitTransform({ x: 5, y: 5, w: 0, h: 0 }, { width: 100, height: 100 });
    expect(Number.isFinite(t.k) && Number.isFinite(t.x) && Number.isFinite(t.y)).toBe(true);
    expect(t.k).toBe(2);
  });
  it('zero-size viewport gives identity', () => {
    expect(fitTransform({ x: 0, y: 0, w: 100, h: 100 }, { width: 0, height: 0 })).toEqual({ k: 1, x: 0, y: 0 });
    expect(fitTransform({ x: 0, y: 0, w: 100, h: 100 }, { width: 500, height: 0 })).toEqual({ k: 1, x: 0, y: 0 });
  });
});
