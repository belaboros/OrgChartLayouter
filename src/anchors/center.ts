import type { AnchorPlugin } from '../plugins/types';
import { shapeCenter } from '../geometry/rect';

export const center: AnchorPlugin = {
  id: 'center',
  name: 'Center to center',
  optionsSchema: [],
  run({ parent, children }) {
    const from = { ...shapeCenter(parent.shape), side: 'center' as const };
    return {
      parent,
      edges: children.map((child) => ({ child, from: { ...from }, to: { ...shapeCenter(child.shape), side: 'center' as const } })),
    };
  },
};
