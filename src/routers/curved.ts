import type { AnchorPoint, OptionSpec, Point, RouterPlugin } from '../plugins/types';
import { getNumber } from '../plugins/options';
import { pt } from './path';

const curvatureSpec: Extract<OptionSpec, { type: 'number' }> = {
  key: 'curvature', label: 'Curvature', type: 'number', min: 0, max: 1, step: 0.05, default: 0.5,
};
export const defaultCurvature = curvatureSpec.default;

const NORMALS: Record<'top' | 'bottom' | 'left' | 'right', Point> = {
  top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

/** Outward unit normal of the anchor's side; center/boundary face the other end. */
function normal(p: AnchorPoint, other: Point, dist: number): Point {
  if (p.side !== 'center' && p.side !== 'boundary') return NORMALS[p.side];
  return dist === 0 ? { x: 0, y: 0 } : { x: (other.x - p.x) / dist, y: (other.y - p.y) / dist };
}

/** Cubic Bézier `M from C c1 c2 to` with control offsets of `curvature · distance` along the anchor normals. */
export function curvedPath(from: AnchorPoint, to: AnchorPoint, curvature: number): string {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const k = curvature * dist;
  const nf = normal(from, to, dist);
  const nt = normal(to, from, dist);
  const c1 = { x: from.x + nf.x * k, y: from.y + nf.y * k };
  const c2 = { x: to.x + nt.x * k, y: to.y + nt.y * k };
  return `M${pt(from)} C${pt(c1)} ${pt(c2)} ${pt(to)}`;
}

export const curved: RouterPlugin = {
  id: 'curved',
  name: 'Curved',
  optionsSchema: [curvatureSpec],
  run({ group }, options) {
    const c = getNumber(options, 'curvature');
    return group.edges.map((e) => ({ fromId: group.parent.id, toId: e.child.id, d: curvedPath(e.from, e.to, c) }));
  },
};
