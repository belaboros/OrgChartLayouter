import type { Point, Shape, Side } from '../plugins/types';
import { shapeCenter } from '../geometry/rect';

export function sidePoint(shape: Shape, side: Side): Point {
  if (shape.kind === 'rect') {
    const { x, y, w, h } = shape;
    switch (side) {
      case 'top': return { x: x + w / 2, y };
      case 'bottom': return { x: x + w / 2, y: y + h };
      case 'left': return { x, y: y + h / 2 };
      case 'right': return { x: x + w, y: y + h / 2 };
    }
  }
  const { cx, cy, r } = shape;
  switch (side) {
    case 'top': return { x: cx, y: cy - r };
    case 'bottom': return { x: cx, y: cy + r };
    case 'left': return { x: cx - r, y: cy };
    case 'right': return { x: cx + r, y: cy };
  }
}

/** Where the ray from the shape's centre toward `toward` crosses the outline; the centre if they coincide. */
export function boundaryPoint(shape: Shape, toward: Point): Point {
  const c = shapeCenter(shape);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  if (shape.kind !== 'rect') {
    const k = shape.r / Math.hypot(dx, dy);
    return { x: c.x + dx * k, y: c.y + dy * k };
  }
  const tx = dx === 0 ? Infinity : shape.w / 2 / Math.abs(dx);
  const ty = dy === 0 ? Infinity : shape.h / 2 / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: c.x + dx * t, y: c.y + dy * t };
}
