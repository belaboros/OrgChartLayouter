import type { Measure } from '../plugins/types';

export function createCanvasMeasure(fontFamily = 'system-ui, sans-serif'): Measure {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = document.createElement('canvas').getContext('2d');
  } catch {
    ctx = null;
  }
  const cache = new Map<string, { width: number; height: number }>();
  return (text, fontSize) => {
    const key = `${fontSize}|${text}`;
    const hit = cache.get(key);
    if (hit) return hit;
    let width = text.length * fontSize * 0.6;
    if (ctx) {
      ctx.font = `${fontSize}px ${fontFamily}`;
      width = ctx.measureText(text).width;
    }
    const result = { width, height: fontSize * 1.2 };
    cache.set(key, result);
    return result;
  };
}
