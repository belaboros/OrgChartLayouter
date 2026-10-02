import type { Ctx } from '../plugins/types';

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
