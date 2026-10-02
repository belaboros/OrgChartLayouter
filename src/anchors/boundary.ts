import type { AnchorPlugin } from '../plugins/types';
import { shapeCenter } from '../geometry/rect';
import { boundaryPoint } from './geometry';

export const boundary: AnchorPlugin = {
  id: 'boundary',
  name: 'Boundary toward center',
  optionsSchema: [],
  run({ parent, children }) {
    const pc = shapeCenter(parent.shape);
    return {
      parent,
      edges: children.map((child) => ({
        child,
        from: { ...boundaryPoint(parent.shape, shapeCenter(child.shape)), side: 'boundary' as const },
        to: { ...boundaryPoint(child.shape, pc), side: 'boundary' as const },
      })),
    };
  },
};
