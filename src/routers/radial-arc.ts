import type { RouterPlugin } from '../plugins/types';
import { curvedPath, defaultCurvature } from './curved';
import { pt } from './path';

/** Wraps an angle into (-π, π]. */
function normalise(a: number): number {
  let r = a % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  else if (r <= -Math.PI) r += 2 * Math.PI;
  return r;
}

export const radialArc: RouterPlugin = {
  id: 'radial-arc',
  name: 'Radial arc',
  optionsSchema: [],
  run({ group, direction, origin }) {
    return group.edges.map((e) => {
      const base = { fromId: group.parent.id, toId: e.child.id };
      if (direction !== 'outward' || !origin) return { ...base, d: curvedPath(e.from, e.to, defaultCurvature) };
      const rf = Math.hypot(e.from.x - origin.x, e.from.y - origin.y);
      const rt = Math.hypot(e.to.x - origin.x, e.to.y - origin.y);
      const af = Math.atan2(e.from.y - origin.y, e.from.x - origin.x);
      const at = Math.atan2(e.to.y - origin.y, e.to.x - origin.x);
      const rm = (rf + rt) / 2;
      const delta = normalise(at - af);
      if (rm === 0 || Math.abs(delta) < 1e-9) return { ...base, d: `M${pt(e.from)} L${pt(e.to)}` };
      const polar = (r: number, a: number) => ({ x: origin.x + r * Math.cos(a), y: origin.y + r * Math.sin(a) });
      const sweep = delta > 0 ? 1 : 0;
      const d = `M${pt(e.from)} L${pt(polar(rm, af))} A${pt({ x: rm, y: rm })} 0 0 ${sweep} ${pt(polar(rm, at))} L${pt(e.to)}`;
      return { ...base, d };
    });
  },
};
