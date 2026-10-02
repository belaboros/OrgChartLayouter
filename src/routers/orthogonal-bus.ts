import type { RouterPlugin } from '../plugins/types';
import { getNumber } from '../plugins/options';
import { cornerRadiusSpec, elbowPoints, polylinePath, routeOrientation } from './path';

export const orthogonalBus: RouterPlugin = {
  id: 'orthogonal-bus',
  name: 'Orthogonal bus',
  optionsSchema: [
    cornerRadiusSpec,
    { key: 'trunkPosition', label: 'Trunk position', type: 'number', min: 0, max: 1, step: 0.05, default: 0.5 },
  ],
  run({ group, direction }, options) {
    const r = getNumber(options, 'cornerRadius');
    const t = getNumber(options, 'trunkPosition');
    const { edges } = group;
    if (edges.length === 0) return [];
    const orientation = routeOrientation(edges[0].from, edges[0].to, direction);
    const vertical = orientation === 'vertical';
    const dist = (e: (typeof edges)[number]) => (vertical ? Math.abs(e.to.y - e.from.y) : Math.abs(e.to.x - e.from.x));
    const nearest = edges.reduce((best, e) => (dist(e) < dist(best) ? e : best));
    const trunk = vertical
      ? nearest.from.y + t * (nearest.to.y - nearest.from.y)
      : nearest.from.x + t * (nearest.to.x - nearest.from.x);
    return edges.map((e) => ({
      fromId: group.parent.id,
      toId: e.child.id,
      d: polylinePath(elbowPoints(e.from, e.to, orientation, trunk), r),
    }));
  },
};
