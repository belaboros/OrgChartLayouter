import type { Point, Rect, Shape } from '../plugins/types';

export function shapeRect(s: Shape): Rect {
  if (s.kind === 'rect') return { x: s.x, y: s.y, w: s.w, h: s.h };
  return { x: s.cx - s.r, y: s.cy - s.r, w: 2 * s.r, h: 2 * s.r };
}

export function shapeCenter(s: Shape): Point {
  if (s.kind === 'rect') return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  return { x: s.cx, y: s.cy };
}

export function unionRects(rs: Rect[]): Rect {
  if (rs.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const x0 = Math.min(...rs.map((r) => r.x));
  const y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w));
  const y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
