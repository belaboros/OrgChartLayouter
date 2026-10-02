import type { AnchorPoint, Direction, OptionSpec, Point } from '../plugins/types';

export const cornerRadiusSpec: OptionSpec = {
  key: 'cornerRadius', label: 'Corner radius', type: 'number', min: 0, max: 20, step: 1, default: 4,
};

/** Up to 3 decimals, no trailing zeros, never "-0". */
export function num(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return String(r === 0 ? 0 : r);
}
export const pt = (p: Point) => `${num(p.x)} ${num(p.y)}`;

/** Absolute `M`/`L` path through the points; interior corners are cut by `cornerRadius` and joined by a `Q`. */
export function polylinePath(points: Point[], cornerRadius: number): string {
  const p = points.filter((q, i) => i === 0 || q.x !== points[i - 1].x || q.y !== points[i - 1].y);
  const parts = [`M${pt(p[0])}`];
  for (let i = 1; i < p.length; i++) {
    const cur = p[i];
    if (i === p.length - 1 || cornerRadius <= 0) {
      parts.push(`L${pt(cur)}`);
      continue;
    }
    const prev = p[i - 1];
    const next = p[i + 1];
    const lenIn = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const lenOut = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(cornerRadius, lenIn / 2, lenOut / 2);
    const a = { x: cur.x - ((cur.x - prev.x) / lenIn) * r, y: cur.y - ((cur.y - prev.y) / lenIn) * r };
    const b = { x: cur.x + ((next.x - cur.x) / lenOut) * r, y: cur.y + ((next.y - cur.y) / lenOut) * r };
    parts.push(`L${pt(a)}`, `Q${pt(cur)} ${pt(b)}`);
  }
  return parts.join(' ');
}

export function routeOrientation(from: AnchorPoint, to: AnchorPoint, direction: Direction): 'vertical' | 'horizontal' {
  if (from.side === 'top' || from.side === 'bottom') return 'vertical';
  if (from.side === 'left' || from.side === 'right') return 'horizontal';
  if (direction === 'down') return 'vertical';
  if (direction === 'right') return 'horizontal';
  return Math.abs(to.x - from.x) > Math.abs(to.y - from.y) ? 'horizontal' : 'vertical';
}

/** Elbow through `lane` (a y for vertical, an x for horizontal), or down-then-across for stacked children. */
export function elbowPoints(from: AnchorPoint, to: AnchorPoint, orientation: 'vertical' | 'horizontal', lane?: number): Point[] {
  if (orientation === 'vertical') {
    if (to.side === 'left' || to.side === 'right') return [from, { x: from.x, y: to.y }, to];
    const y = lane ?? (from.y + to.y) / 2;
    return [from, { x: from.x, y }, { x: to.x, y }, to];
  }
  const x = lane ?? (from.x + to.x) / 2;
  return [from, { x, y: from.y }, { x, y: to.y }, to];
}
