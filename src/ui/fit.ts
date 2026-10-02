import type { Rect } from '../plugins/types';

export function fitTransform(
  bounds: Rect,
  viewport: { width: number; height: number },
  margin = 20,
): { k: number; x: number; y: number } {
  const { width: vw, height: vh } = viewport;
  if (vw <= 0 || vh <= 0) return { k: 1, x: 0, y: 0 };
  const w = (bounds.w || 1) + 2 * margin;
  const h = (bounds.h || 1) + 2 * margin;
  const k = Math.min(2, vw / w, vh / h);
  return {
    k,
    x: (vw - w * k) / 2 + (margin - bounds.x) * k,
    y: (vh - h * k) / 2 + (margin - bounds.y) * k,
  };
}
