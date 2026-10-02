import { describe, it, expect } from 'vitest';
import { routers } from '../../src/routers/registry';
import { findPlugin } from '../../src/layouts/registry';
import { parsePath } from '../helpers/svg-path';
import { fakeCtx } from '../helpers/fake-measure';
import type { AnchorPoint, EdgeGroup, PlacedNode, Point } from '../../src/plugins/types';

const node = (id: string): PlacedNode => ({
  id, name: id, depth: 1, parentId: null, hiddenDescendants: 0, stacked: false,
  shape: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 }, label: { text: id, x: 0, y: 0, anchor: 'middle', rotate: 0 },
});
const A = (x: number, y: number, side: AnchorPoint['side']): AnchorPoint => ({ x, y, side });
const group = (edges: { id: string; from: AnchorPoint; to: AnchorPoint }[]): EdgeGroup => ({
  parent: node('p'),
  edges: edges.map((e) => ({ child: node(e.id), from: e.from, to: e.to })),
});
const run = (id: string, g: EdgeGroup, o: Record<string, unknown>, direction: 'down' | 'right' = 'down') =>
  findPlugin(routers, id)!.run({ group: g, direction, origin: null }, o, fakeCtx);
const pts = (d: string): Point[] => parsePath(d).flatMap((s) => (s.cmd === 'Q' ? [s.pts[1]] : s.pts));

const tree = group([
  { id: 'a', from: A(20, 20, 'bottom'), to: A(0, 100, 'top') },
  { id: 'b', from: A(20, 20, 'bottom'), to: A(60, 120, 'top') },
]);

describe('registry', () => {
  it('has the three routers with schemas', () => {
    expect(routers.map((r) => r.id)).toEqual(['straight', 'orthogonal-elbow', 'orthogonal-bus']);
    expect(findPlugin(routers, 'straight')!.optionsSchema).toEqual([]);
    expect(findPlugin(routers, 'orthogonal-elbow')!.optionsSchema.map((s) => s.key)).toEqual(['cornerRadius']);
    expect(findPlugin(routers, 'orthogonal-bus')!.optionsSchema.map((s) => s.key)).toEqual(['cornerRadius', 'trunkPosition']);
  });
});

describe('straight', () => {
  it('is M from L to, with ids', () => {
    const out = run('straight', tree, {});
    expect(out).toEqual([
      { fromId: 'p', toId: 'a', d: 'M20 20 L0 100' },
      { fromId: 'p', toId: 'b', d: 'M20 20 L60 120' },
    ]);
  });
});

describe('orthogonal-elbow', () => {
  it('vertical bends at the midpoint', () => {
    const out = run('orthogonal-elbow', tree, { cornerRadius: 0 });
    expect(pts(out[0].d)).toEqual([{ x: 20, y: 20 }, { x: 20, y: 60 }, { x: 0, y: 60 }, { x: 0, y: 100 }]);
    expect(pts(out[1].d)).toEqual([{ x: 20, y: 20 }, { x: 20, y: 70 }, { x: 60, y: 70 }, { x: 60, y: 120 }]);
    expect(out.map((o) => [o.fromId, o.toId])).toEqual([['p', 'a'], ['p', 'b']]);
  });
  it('horizontal bends at the x midpoint', () => {
    const g = group([{ id: 'a', from: A(20, 20, 'right'), to: A(100, 0, 'left') }]);
    const out = run('orthogonal-elbow', g, { cornerRadius: 0 }, 'right');
    expect(pts(out[0].d)).toEqual([{ x: 20, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 0 }, { x: 100, y: 0 }]);
  });
  it('to a stacked child goes down then across', () => {
    const g = group([{ id: 'a', from: A(20, 20, 'bottom'), to: A(40, 80, 'left') }]);
    const out = run('orthogonal-elbow', g, { cornerRadius: 0 });
    expect(pts(out[0].d)).toEqual([{ x: 20, y: 20 }, { x: 20, y: 80 }, { x: 40, y: 80 }]);
  });
  it('cornerRadius adds Q segments', () => {
    const out = run('orthogonal-elbow', tree, { cornerRadius: 4 });
    expect(parsePath(out[0].d).map((s) => s.cmd)).toEqual(['M', 'L', 'Q', 'L', 'Q', 'L']);
  });
  it('center anchors still produce a polyline along the orientation', () => {
    const g = group([{ id: 'a', from: A(0, 0, 'center'), to: A(100, 10, 'center') }]);
    expect(pts(run('orthogonal-elbow', g, { cornerRadius: 0 }, 'right')[0].d)).toEqual(
      [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 10 }, { x: 100, y: 10 }],
    );
  });
});

describe('orthogonal-bus', () => {
  it('children share one trunk', () => {
    const out = run('orthogonal-bus', tree, { cornerRadius: 0, trunkPosition: 0.5 });
    expect(pts(out[0].d)).toEqual([{ x: 20, y: 20 }, { x: 20, y: 60 }, { x: 0, y: 60 }, { x: 0, y: 100 }]);
    expect(pts(out[1].d)).toEqual([{ x: 20, y: 20 }, { x: 20, y: 60 }, { x: 60, y: 60 }, { x: 60, y: 120 }]);
  });
  it('trunkPosition scales the distance to the nearest child', () => {
    const out = run('orthogonal-bus', tree, { cornerRadius: 0, trunkPosition: 0.25 });
    expect(pts(out[1].d)[1].y).toBe(40);
    expect(pts(out[0].d)[1].y).toBe(40);
  });
  it('nearest child is found regardless of order', () => {
    const rev = group([...tree.edges].reverse().map((e) => ({ id: e.child.id, from: e.from, to: e.to })));
    const out = run('orthogonal-bus', rev, { cornerRadius: 0, trunkPosition: 0.5 });
    expect(pts(out[0].d)[1].y).toBe(60);
  });
  it('horizontal trunk uses x', () => {
    const g = group([
      { id: 'a', from: A(20, 20, 'right'), to: A(120, 0, 'left') },
      { id: 'b', from: A(20, 20, 'right'), to: A(60, 90, 'left') },
    ]);
    const out = run('orthogonal-bus', g, { cornerRadius: 0, trunkPosition: 0.5 }, 'right');
    expect(pts(out[0].d)).toEqual([{ x: 20, y: 20 }, { x: 40, y: 20 }, { x: 40, y: 0 }, { x: 120, y: 0 }]);
    expect(pts(out[1].d)).toEqual([{ x: 20, y: 20 }, { x: 40, y: 20 }, { x: 40, y: 90 }, { x: 60, y: 90 }]);
  });
  it('zero distance puts the trunk at from', () => {
    const g = group([{ id: 'a', from: A(20, 20, 'bottom'), to: A(0, 20, 'top') }]);
    expect(pts(run('orthogonal-bus', g, { cornerRadius: 0, trunkPosition: 0.5 })[0].d).every((p) => p.y === 20)).toBe(true);
  });
  it('mixed from-sides: orientation per edge, trunk from the vertical set only', () => {
    const g = group([
      { id: 'a', from: A(20, 20, 'bottom'), to: A(0, 100, 'top') },
      { id: 'b', from: A(30, 10, 'right'), to: A(90, 50, 'left') },
      { id: 'c', from: A(20, 20, 'bottom'), to: A(60, 60, 'top') },
    ]);
    const out = run('orthogonal-bus', g, { cornerRadius: 0, trunkPosition: 0.5 });
    expect(pts(out[0].d)).toEqual([{ x: 20, y: 20 }, { x: 20, y: 40 }, { x: 0, y: 40 }, { x: 0, y: 100 }]);
    expect(pts(out[2].d)).toEqual([{ x: 20, y: 20 }, { x: 20, y: 40 }, { x: 60, y: 40 }, { x: 60, y: 60 }]);
    expect(pts(out[1].d)).toEqual([{ x: 30, y: 10 }, { x: 60, y: 10 }, { x: 60, y: 50 }, { x: 90, y: 50 }]);
  });
  it('stacked edges do not set the trunk', () => {
    const g = group([
      { id: 'a', from: A(20, 20, 'bottom'), to: A(40, 30, 'left') },
      { id: 'b', from: A(20, 20, 'bottom'), to: A(0, 100, 'top') },
    ]);
    const out = run('orthogonal-bus', g, { cornerRadius: 0, trunkPosition: 0.5 });
    expect(pts(out[0].d)).toEqual([{ x: 20, y: 20 }, { x: 20, y: 30 }, { x: 40, y: 30 }]);
    expect(pts(out[1].d)).toEqual([{ x: 20, y: 20 }, { x: 20, y: 60 }, { x: 0, y: 60 }, { x: 0, y: 100 }]);
  });
  it('stacked children behave like elbow', () => {
    const g = group([{ id: 'a', from: A(20, 20, 'bottom'), to: A(40, 80, 'left') }]);
    expect(pts(run('orthogonal-bus', g, { cornerRadius: 0, trunkPosition: 0.5 })[0].d)).toEqual(
      [{ x: 20, y: 20 }, { x: 20, y: 80 }, { x: 40, y: 80 }],
    );
  });
});
