import { describe, it, expect } from 'vitest';
import { parseClamped } from '../../src/ui/number-input';

describe('parseClamped', () => {
  it('returns null for empty or non-finite input', () => {
    expect(parseClamped('', 8, 32, 1)).toBeNull();
    expect(parseClamped('  ', 8, 32, 1)).toBeNull();
    expect(parseClamped('abc', 8, 32, 1)).toBeNull();
    expect(parseClamped('Infinity', 8, 32, 1)).toBeNull();
  });
  it('keeps in-range values', () => expect(parseClamped('12', 8, 32, 1)).toBe(12));
  it('clamps above max and below min', () => {
    expect(parseClamped('99', 8, 32, 1)).toBe(32);
    expect(parseClamped('1', 8, 32, 1)).toBe(8);
  });
  it('clamps then snaps to step', () => {
    expect(parseClamped('0', 0.5, 6, 0.5)).toBe(0.5);
    expect(parseClamped('1.3', 0.5, 6, 0.5)).toBe(1.5);
    expect(parseClamped('10.4', 8, 32, 1)).toBe(10);
  });
  it('snaps relative to min and avoids float noise', () => {
    expect(parseClamped('0.3', 0.1, 1, 0.1)).toBe(0.3);
    expect(parseClamped('12', 10, 150, 5)).toBe(10);
  });
  it('works without a step', () => expect(parseClamped('1.234', 0, 5)).toBe(1.234));
});
