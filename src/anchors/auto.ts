import type { AnchorPlugin, Edge } from '../plugins/types';
import { shapeCenter } from '../geometry/rect';
import { boundaryPoint, sidePoint } from './geometry';

export const auto: AnchorPlugin = {
  id: 'auto',
  name: 'Auto',
  optionsSchema: [],
  run({ parent, children, direction }) {
    const pc = shapeCenter(parent.shape);
    const edges = children.map((child): Edge => {
      const cc = shapeCenter(child.shape);
      if (direction === 'outward' || direction === 'none') {
        return {
          child,
          from: { ...boundaryPoint(parent.shape, cc), side: 'boundary' },
          to: { ...boundaryPoint(child.shape, pc), side: 'boundary' },
        };
      }
      if (child.stacked) {
        const cs = cc.x > pc.x ? 'left' : 'right';
        return {
          child,
          from: { ...sidePoint(parent.shape, 'bottom'), side: 'bottom' },
          to: { ...sidePoint(child.shape, cs), side: cs },
        };
      }
      const [ps, cs] = direction === 'right' ? (['right', 'left'] as const) : (['bottom', 'top'] as const);
      return {
        child,
        from: { ...sidePoint(parent.shape, ps), side: ps },
        to: { ...sidePoint(child.shape, cs), side: cs },
      };
    });
    return { parent, edges };
  },
};
