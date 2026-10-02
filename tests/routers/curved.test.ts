import { describe, it, expect } from 'vitest';
import { routers } from '../../src/routers/registry';
import { findPlugin } from '../../src/layouts/registry';
import { curvedPath } from '../../src/routers/curved';
import { resolveOptions } from '../../src/plugins/options';
import { parsePath } from '../helpers/svg-path';
import { fakeCtx } from '../helpers/fake-measure';
import type { AnchorPoint, EdgeGroup, PlacedNode } from '../../src/plugins/types';

const node = (id: string): PlacedNode => ({
  id, name: id, depth: 1, parentId: null, hiddenDescendants: 0, stacked: false,
  shape: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 }, label: { text: id, x: 0, y: 0, anchor: 'middle', rotate: 0 },
});
const A = (x: number, y: number, side: AnchorPoint['side']): AnchorPoint => ({ x, y, side });
const group = (from: AnchorPoint, to: AnchorPoint): EdgeGroup => ({
  parent: node('p'), edges: [{ child: node('c'), from, to }],
});
const runR = (id: string, g: EdgeGroup, direction: 'down' | 'outward', origin: { x: number; y: number } | null, o = {}) =>
  findPlugin(routers, id)!.run({ group: g, direction, origin }, resolveOptions(findPlugin(routers, id)!.optionsSchema, o), fakeCtx)[0].d;

describe('curved', () => {
  it('bottom→top uses vertical control points', () => {
    const [m, seg] = parsePath(curvedPath(A(0, 0, 'bottom'), A(0, 100, 'top'), 0.5));
    expect(m).toEqual({ cmd: 'M', pts: [{ x: 0, y: 0 }] });
    expect(seg.cmd).toBe('C');
    expect(seg.pts).toEqual([{ x: 0, y: 50 }, { x: 0, y: 50 }, { x: 0, y: 100 }]);
  });
  it('scales k by distance and uses each side normal', () => {
    // distance 50 (30,40), k = 0.2*50 = 10; right normal (1,0), left normal (-1,0)
    const [, seg] = parsePath(curvedPath(A(10, 10, 'right'), A(40, 50, 'left'), 0.2));
    expect(seg.pts).toEqual([{ x: 20, y: 10 }, { x: 30, y: 50 }, { x: 40, y: 50 }]);
    // top normal (0,-1), bottom normal (0,1)
    const [, s2] = parsePath(curvedPath(A(0, 0, 'top'), A(30, 40, 'bottom'), 0.2));
    expect(s2.pts).toEqual([{ x: 0, y: -10 }, { x: 30, y: 50 }, { x: 30, y: 40 }]);
  });
  it('center/boundary normals point toward the other end', () => {
    const [, seg] = parsePath(curvedPath(A(0, 0, 'center'), A(30, 40, 'boundary'), 0.5)); // k=25
    expect(seg.pts[0].x).toBeCloseTo(15); expect(seg.pts[0].y).toBeCloseTo(20);
    expect(seg.pts[1].x).toBeCloseTo(15); expect(seg.pts[1].y).toBeCloseTo(20);
    expect(seg.pts[2]).toEqual({ x: 30, y: 40 });
  });
  it('zero curvature puts control points on the endpoints', () => {
    const [, seg] = parsePath(curvedPath(A(0, 0, 'bottom'), A(5, 100, 'top'), 0));
    expect(seg.pts).toEqual([{ x: 0, y: 0 }, { x: 5, y: 100 }, { x: 5, y: 100 }]);
  });
  it('coincident endpoints give a degenerate but valid curve', () => {
    expect(curvedPath(A(3, 4, 'center'), A(3, 4, 'center'), 0.5)).toBe('M3 4 C3 4 3 4 3 4');
  });
  it('router option curvature is applied and defaults to 0.5', () => {
    const g = group(A(0, 0, 'bottom'), A(0, 100, 'top'));
    const r = findPlugin(routers, 'curved')!;
    expect(r.optionsSchema).toMatchObject([{ key: 'curvature', type: 'number', min: 0, max: 1, step: 0.05, default: 0.5 }]);
    expect(runR('curved', g, 'down', null)).toBe(curvedPath(g.edges[0].from, g.edges[0].to, 0.5));
    expect(runR('curved', g, 'down', null, { curvature: 0.25 })).toBe('M0 0 C0 25 0 75 0 100');
  });
});

describe('radial-arc', () => {
  it('outward emits an A at the mid radius', () => {
    const g = group(A(10, 0, 'boundary'), A(0, 30, 'boundary'));
    const segs = parsePath(runR('radial-arc', g, 'outward', { x: 0, y: 0 }));
    expect(segs.map((s) => s.cmd)).toEqual(['M', 'L', 'A', 'L']);
    expect(segs[0].pts[0]).toEqual({ x: 10, y: 0 });
    expect(segs[1].pts[0]).toEqual({ x: 20, y: 0 });
    // af=0, at=π/2: Δ>0 → sweep 1, small arc
    expect(segs[2].args).toEqual([20, 20, 0, 0, 1, 0, 20]);
    expect(segs[3].pts[0]).toEqual({ x: 0, y: 30 });
  });
  it('negative angle change sweeps 0, and respects a non-zero origin', () => {
    const g = group(A(110, 100, 'boundary'), A(100, 70, 'boundary'));
    const segs = parsePath(runR('radial-arc', g, 'outward', { x: 100, y: 100 }));
    expect(segs[1].pts[0]).toEqual({ x: 120, y: 100 });
    expect(segs[2].args).toEqual([20, 20, 0, 0, 0, 100, 80]);
  });
  it('wraps the angle difference into (-π, π] with largeArc 0', () => {
    // af = 170°, at = -170° → Δ = +20° (not -340°)
    const a = (deg: number, r: number) => A(r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180), 'boundary');
    const segs = parsePath(runR('radial-arc', group(a(170, 10), a(-170, 10)), 'outward', { x: 0, y: 0 }));
    expect(segs[2].args!.slice(2, 5)).toEqual([0, 0, 1]);
  });
  it('same angle or both at origin skips the arc', () => {
    expect(runR('radial-arc', group(A(10, 0, 'boundary'), A(30, 0, 'boundary')), 'outward', { x: 0, y: 0 })).toBe('M10 0 L30 0');
    expect(runR('radial-arc', group(A(0, 0, 'center'), A(0, 0, 'center')), 'outward', { x: 0, y: 0 })).toBe('M0 0 L0 0');
  });
  it('falls back to curved when not outward or no origin', () => {
    const g = group(A(0, 0, 'bottom'), A(20, 100, 'top'));
    const expected = runR('curved', g, 'down', null);
    expect(runR('radial-arc', g, 'down', { x: 0, y: 0 })).toBe(expected);
    expect(runR('radial-arc', g, 'outward', null)).toBe(expected);
  });
});
