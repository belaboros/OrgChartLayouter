import { describe, it, expect } from 'vitest';
import { boxFor, fitLabel } from '../../src/layouts/label';
import { fakeCtx } from '../helpers/fake-measure';

describe('label', () => {
  it('boxFor adds padding', () => expect(boxFor('abcd', fakeCtx)).toEqual({ w: 24 + 16, h: 12 + 8 }));
  it('fitLabel keeps text that fits', () => expect(fitLabel('abcd', 24, fakeCtx)).toBe('abcd'));
  it('fitLabel truncates with an ellipsis', () => expect(fitLabel('abcdefgh', 30, fakeCtx)).toBe('abcd…'));
  it('fitLabel handles an 80-char name in a tiny box', () => expect(fitLabel('x'.repeat(80), 3, fakeCtx)).toBe(''));
});
