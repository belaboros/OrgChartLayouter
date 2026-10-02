import type { Shape } from '../../src/plugins/types';
import { shapeRect } from '../../src/geometry/rect';

type Round = Extract<Shape, { kind: 'circle' | 'dot' }>;
const isRound = (s: Shape): s is Round => s.kind !== 'rect';

export function overlaps(a: Shape, b: Shape, eps = 0.5): boolean {
  if (a.kind === 'rect' && b.kind === 'rect') {
    return a.x + a.w > b.x + eps && b.x + b.w > a.x + eps && a.y + a.h > b.y + eps && b.y + b.h > a.y + eps;
  }
  if (isRound(a) && isRound(b)) {
    return Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.r + b.r - eps;
  }
  throw new Error(`overlaps: mixed shape kinds ${a.kind}/${b.kind}`);
}

export function contains(outer: Shape, inner: Shape, eps = 0.5): boolean {
  if (isRound(outer) && isRound(inner)) {
    return Math.hypot(outer.cx - inner.cx, outer.cy - inner.cy) + inner.r <= outer.r + eps;
  }
  if (outer.kind !== 'rect') throw new Error(`contains: a ${inner.kind} cannot be tested inside a ${outer.kind}`);
  const i = shapeRect(inner);
  return (
    i.x >= outer.x - eps &&
    i.y >= outer.y - eps &&
    i.x + i.w <= outer.x + outer.w + eps &&
    i.y + i.h <= outer.y + outer.h + eps
  );
}
