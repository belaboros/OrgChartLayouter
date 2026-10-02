import type { RouterPlugin } from '../plugins/types';
import { getNumber } from '../plugins/options';
import { cornerRadiusSpec, elbowPoints, polylinePath, routeOrientation } from './path';

export const orthogonalElbow: RouterPlugin = {
  id: 'orthogonal-elbow',
  name: 'Orthogonal elbow',
  optionsSchema: [cornerRadiusSpec],
  run({ group, direction }, options) {
    const r = getNumber(options, 'cornerRadius');
    return group.edges.map((e) => ({
      fromId: group.parent.id,
      toId: e.child.id,
      d: polylinePath(elbowPoints(e.from, e.to, routeOrientation(e.from, e.to, direction)), r),
    }));
  },
};
