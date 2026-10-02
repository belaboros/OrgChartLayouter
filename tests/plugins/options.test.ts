import { describe, it, expect } from 'vitest';
import { resolveOptions, getNumber, getString, getBoolean } from '../../src/plugins/options';
import type { OptionsSchema } from '../../src/plugins/types';

const schema: OptionsSchema = [
  { key: 'gap', label: 'Gap', type: 'number', min: 0, max: 80, step: 1, default: 16 },
  { key: 'mode', label: 'Mode', type: 'select', choices: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], default: 'a' },
  { key: 'on', label: 'On', type: 'boolean', default: true },
];

describe('options', () => {
  it('fills defaults', () => expect(resolveOptions(schema)).toEqual({ gap: 16, mode: 'a', on: true }));
  it('clamps numbers and rejects bad values', () =>
    expect(resolveOptions(schema, { gap: 500, mode: 'zzz', on: 'yes', extra: 1 })).toEqual({ gap: 80, mode: 'a', on: true }));
  it('keeps valid stored values', () =>
    expect(resolveOptions(schema, { gap: 3, mode: 'b', on: false })).toEqual({ gap: 3, mode: 'b', on: false }));
  it('getNumber throws on missing key', () => expect(() => getNumber({}, 'gap')).toThrow());
  it('getters return typed values and throw on wrong type', () => {
    expect(getNumber({ a: 1 }, 'a')).toBe(1);
    expect(getString({ a: 's' }, 'a')).toBe('s');
    expect(getBoolean({ a: false }, 'a')).toBe(false);
    expect(() => getString({ a: 1 }, 'a')).toThrow();
    expect(() => getBoolean({ a: 1 }, 'a')).toThrow();
  });
});
