import type { Options, OptionsSchema } from './types';

export function resolveOptions(schema: OptionsSchema, stored: Options = {}): Options {
  const out: Options = {};
  for (const spec of schema) {
    const v = stored[spec.key];
    switch (spec.type) {
      case 'number':
        out[spec.key] =
          typeof v === 'number' && Number.isFinite(v) ? Math.min(spec.max, Math.max(spec.min, v)) : spec.default;
        break;
      case 'select':
        out[spec.key] =
          typeof v === 'string' && spec.choices.some((c) => c.value === v) ? v : spec.default;
        break;
      case 'boolean':
        out[spec.key] = typeof v === 'boolean' ? v : spec.default;
        break;
    }
  }
  return out;
}

function get<T>(o: Options, key: string, type: 'number' | 'string' | 'boolean'): T {
  const v = o[key];
  if (typeof v !== type) throw new Error(`Option "${key}" is missing or not a ${type}`);
  return v as T;
}

export const getNumber = (o: Options, key: string): number => get<number>(o, key, 'number');
export const getString = (o: Options, key: string): string => get<string>(o, key, 'string');
export const getBoolean = (o: Options, key: string): boolean => get<boolean>(o, key, 'boolean');
