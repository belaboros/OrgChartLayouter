import type { Point } from '../../src/plugins/types';

export interface PathSegment { cmd: 'M' | 'L' | 'Q' | 'C' | 'A'; pts: Point[]; /** A only: rx ry rotation largeArc sweep x y */ args?: number[] }

/** Parses absolute M/L/Q/C/A path data; `pts` are the command's points, the last is the endpoint. */
export function parsePath(d: string): PathSegment[] {
  const out: PathSegment[] = [];
  for (const m of d.matchAll(/([MLQCA])([^MLQCA]*)/g)) {
    const nums = (m[2].match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    const cmd = m[1] as PathSegment['cmd'];
    const pts: Point[] = [];
    if (cmd === 'A') {
      pts.push({ x: nums[5], y: nums[6] });
    } else {
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
    }
    out.push(cmd === 'A' ? { cmd, pts, args: nums.slice(0, 7) } : { cmd, pts });
  }
  return out;
}
