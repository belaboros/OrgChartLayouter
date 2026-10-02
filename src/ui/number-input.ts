/** Parse a raw numeric field value: null if empty/non-finite, else clamped to [min, max] and snapped to step. */
export function parseClamped(raw: string, min: number, max: number, step?: number): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  let v = Math.min(max, Math.max(min, n));
  if (step !== undefined && step > 0) {
    v = min + Math.round((v - min) / step) * step;
    v = Math.min(max, Math.max(min, v));
  }
  return Math.round(v * 1e10) / 1e10;
}
