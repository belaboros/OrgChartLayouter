import type { Ctx, PlacedNode, Rect } from '../plugins/types';
import { shapeRect } from '../geometry/rect';

export const BOX_PAD_X = 8;
export const BOX_PAD_Y = 4;

export function boxFor(name: string, ctx: Ctx): { w: number; h: number } {
  const m = ctx.measure(name, ctx.fontSize);
  return { w: m.width + 2 * BOX_PAD_X, h: m.height + 2 * BOX_PAD_Y };
}

export function fitLabel(text: string, maxWidth: number, ctx: Ctx): string {
  const width = (s: string) => ctx.measure(s, ctx.fontSize).width;
  if (width(text) <= maxWidth) return text;
  for (let n = text.length - 1; n >= 0; n--) {
    const candidate = text.slice(0, n) + '…';
    if (width(candidate) <= maxWidth) return candidate;
  }
  return '';
}

/**
 * The area a node's label covers (R16). Labels centred inside a shape are covered by the shape rect.
 * A dot label starts at its anchor point and runs outward along the ray from the dot centre through
 * that point for the measured text width, with half the text height on either side.
 */
export function labelExtent(node: PlacedNode, ctx: Ctx): Rect {
  const s = node.shape;
  if (s.kind !== 'dot') return shapeRect(s);
  const { text, x, y } = node.label;
  const len = Math.hypot(x - s.cx, y - s.cy);
  const ux = len > 0 ? (x - s.cx) / len : 1;
  const uy = len > 0 ? (y - s.cy) / len : 0;
  const m = ctx.measure(text, ctx.fontSize);
  const hx = (-uy * m.height) / 2;
  const hy = (ux * m.height) / 2;
  const ex = x + ux * m.width;
  const ey = y + uy * m.width;
  const xs = [x + hx, x - hx, ex + hx, ex - hx];
  const ys = [y + hy, y - hy, ey + hy, ey - hy];
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
}
