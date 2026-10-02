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
    type Orientation = 'vertical' | 'horizontal';
    const orient = edges.map((e) => routeOrientation(e.from, e.to, direction));
    // Per orientation, the trunk is set by the nearest child among edges that actually use a trunk
    // (vertical edges into a left/right side are stacked and route like an elbow).
    const trunks: Record<Orientation, number | undefined> = { vertical: undefined, horizontal: undefined };
    for (const o of ['vertical', 'horizontal'] as const) {
      const dist = (e: (typeof edges)[number]) => (o === 'vertical' ? Math.abs(e.to.y - e.from.y) : Math.abs(e.to.x - e.from.x));
      const used = edges.filter((e, i) => orient[i] === o && !(o === 'vertical' && (e.to.side === 'left' || e.to.side === 'right')));
      if (used.length === 0) continue;
      const nearest = used.reduce((best, e) => (dist(e) < dist(best) ? e : best));
      trunks[o] = o === 'vertical'
        ? nearest.from.y + t * (nearest.to.y - nearest.from.y)
        : nearest.from.x + t * (nearest.to.x - nearest.from.x);
    }
    return edges.map((e, i) => ({
      fromId: group.parent.id,
      toId: e.child.id,
      d: polylinePath(elbowPoints(e.from, e.to, orient[i], trunks[orient[i]]), r),
    }));
  },
};
