import type { AnchorPlugin, Side } from '../plugins/types';
import { sidePoint } from './geometry';

const SIDES: Side[] = ['top', 'bottom', 'left', 'right'];

export const nearestSides: AnchorPlugin = {
  id: 'nearest-sides',
  name: 'Nearest sides',
  optionsSchema: [],
  run({ parent, children }) {
    return {
      parent,
      edges: children.map((child) => {
        let best = { ps: SIDES[0], cs: SIDES[0], d: Infinity };
        for (const ps of SIDES) {
          const a = sidePoint(parent.shape, ps);
          for (const cs of SIDES) {
            const b = sidePoint(child.shape, cs);
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < best.d) best = { ps, cs, d };
          }
        }
        return {
          child,
          from: { ...sidePoint(parent.shape, best.ps), side: best.ps },
          to: { ...sidePoint(child.shape, best.cs), side: best.cs },
        };
      }),
    };
  },
};
