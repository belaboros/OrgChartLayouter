import type { AnchorPlugin, OptionSpec, Side } from '../plugins/types';
import { getString } from '../plugins/options';
import { sidePoint } from './geometry';

const choices = (['top', 'bottom', 'left', 'right'] as const).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
const sideSpec = (key: string, label: string, def: Side): OptionSpec => ({ key, label, type: 'select', choices, default: def });

export const fixedSides: AnchorPlugin = {
  id: 'fixed-sides',
  name: 'Fixed sides',
  optionsSchema: [sideSpec('parentSide', 'Parent side', 'bottom'), sideSpec('childSide', 'Child side', 'top')],
  run({ parent, children }, options) {
    const ps = getString(options, 'parentSide') as Side;
    const cs = getString(options, 'childSide') as Side;
    return {
      parent,
      edges: children.map((child) => ({
        child,
        from: { ...sidePoint(parent.shape, ps), side: ps },
        to: { ...sidePoint(child.shape, cs), side: cs },
      })),
    };
  },
};
