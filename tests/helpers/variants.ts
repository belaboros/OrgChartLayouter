import type { Options, OptionsSchema } from '../../src/plugins/types';
import { resolveOptions } from '../../src/plugins/options';

/** The defaults, plus one variant per alternative value; each variant changes exactly one key. */
export function optionVariants(schema: OptionsSchema): Options[] {
  const defaults = resolveOptions(schema);
  const out: Options[] = [defaults];
  for (const spec of schema) {
    const alts: unknown[] =
      spec.type === 'number'
        ? [spec.min, spec.max]
        : spec.type === 'select'
          ? spec.choices.map((c) => c.value)
          : [!spec.default];
    for (const v of alts) {
      if (v === defaults[spec.key]) continue;
      out.push({ ...defaults, [spec.key]: v });
    }
  }
  return out;
}
