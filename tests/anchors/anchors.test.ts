import { describe, it, expect } from 'vitest';
import { anchors } from '../../src/anchors/registry';
import { findPlugin } from '../../src/layouts/registry';
import { resolveOptions } from '../../src/plugins/options';
import { fakeCtx } from '../helpers/fake-measure';
import type { AnchorPlugin, Direction, PlacedNode } from '../../src/plugins/types';

const node = (id: string, x: number, y: number, w = 40, h = 20, stacked = false): PlacedNode => ({
  id, name: id, depth: 1, parentId: null, hiddenDescendants: 0, stacked,
  shape: { kind: 'rect', x, y, w, h },
  label: { text: id, x, y, anchor: 'middle', rotate: 0 },
});
const P = node('P', 0, 0);
const K = node('K', 0, 100);

function run(id: string, parent: PlacedNode, children: PlacedNode[], direction: Direction, opts = {}) {
  const a = findPlugin<AnchorPlugin>(anchors, id)!;
  return a.run({ parent, children, direction }, resolveOptions(a.optionsSchema, opts), fakeCtx);
}

describe('anchors', () => {
  it('registry ids', () => expect(anchors.map((a) => a.id)).toEqual(['auto', 'center', 'fixed-sides', 'nearest-sides', 'boundary']));
  it('auto down: bottom to top', () => {
    const g = run('auto', P, [K], 'down');
    expect(g.parent).toBe(P);
    expect(g.edges[0].child).toBe(K);
    expect(g.edges[0].from).toEqual({ x: 20, y: 20, side: 'bottom' });
    expect(g.edges[0].to).toEqual({ x: 20, y: 100, side: 'top' });
  });
  it('auto right: right to left', () => {
    const k = node('K', 100, 0, 30, 10);
    const g = run('auto', P, [k], 'right');
    expect(g.edges[0].from).toEqual({ x: 40, y: 10, side: 'right' });
    expect(g.edges[0].to).toEqual({ x: 100, y: 5, side: 'left' });
  });
  it('auto outward/none uses boundary points', () => {
    for (const d of ['outward', 'none'] as Direction[]) {
      const k = node('K', 200, 0);
      const g = run('auto', P, [k], d);
      expect(g.edges[0].from).toEqual({ x: 40, y: 10, side: 'boundary' });
      expect(g.edges[0].to).toEqual({ x: 200, y: 10, side: 'boundary' });
    }
  });
  it('auto stacked: child side faces the trunk', () => {
    const right = run('auto', P, [node('K', 60, 100, 30, 20, true)], 'down').edges[0];
    expect(right.from).toEqual({ x: 20, y: 20, side: 'bottom' });
    expect(right.to).toEqual({ x: 60, y: 110, side: 'left' });
    const left = run('auto', P, [node('K', -60, 100, 30, 20, true)], 'down').edges[0];
    expect(left.to).toEqual({ x: -30, y: 110, side: 'right' });
    // centre x equal to the parent's centre x: right
    expect(run('auto', P, [node('K', 5, 100, 30, 20, true)], 'down').edges[0].to.side).toBe('right');
  });
  it('auto: stacked and plain siblings are decided per child, order kept', () => {
    const a = node('A', 60, 100, 30, 20, true);
    const g = run('auto', P, [a, K], 'down');
    expect(g.edges.map((e) => e.child.id)).toEqual(['A', 'K']);
    expect(g.edges.map((e) => e.to.side)).toEqual(['left', 'top']);
  });
  it('center anchors at shape centres', () => {
    const e = run('center', P, [node('K', 0, 100, 30, 10)], 'down').edges[0];
    expect(e.from).toEqual({ x: 20, y: 10, side: 'center' });
    expect(e.to).toEqual({ x: 15, y: 105, side: 'center' });
  });
  it('fixed-sides defaults to bottom/top', () => {
    const e = run('fixed-sides', P, [K], 'down').edges[0];
    expect([e.from.side, e.to.side]).toEqual(['bottom', 'top']);
  });
  it('fixed-sides honours options', () => {
    const k = node('K', 100, 0, 30, 10);
    const e = run('fixed-sides', P, [k], 'down', { parentSide: 'right', childSide: 'left' }).edges[0];
    expect(e.from).toEqual({ x: 40, y: 10, side: 'right' });
    expect(e.to).toEqual({ x: 100, y: 5, side: 'left' });
    const f = run('fixed-sides', P, [k], 'down', { parentSide: 'top', childSide: 'bottom' }).edges[0];
    expect(f.from).toEqual({ x: 20, y: 0, side: 'top' });
    expect(f.to).toEqual({ x: 115, y: 10, side: 'bottom' });
  });
  it('nearest-sides picks the shortest pair', () => {
    const right = run('nearest-sides', P, [node('K', 100, 0)], 'down').edges[0];
    expect([right.from.side, right.to.side]).toEqual(['right', 'left']);
    const below = run('nearest-sides', P, [K], 'down').edges[0];
    expect([below.from.side, below.to.side]).toEqual(['bottom', 'top']);
    const above = run('nearest-sides', K, [P], 'down').edges[0];
    expect([above.from.side, above.to.side]).toEqual(['top', 'bottom']);
    const left = run('nearest-sides', node('Q', 100, 0), [P], 'down').edges[0];
    expect([left.from.side, left.to.side]).toEqual(['left', 'right']);
  });
  it('nearest-sides breaks ties by order top, bottom, left, right', () => {
    // identical rects overlapping exactly: every same-side pair has distance 0; first is top/top
    const e = run('nearest-sides', P, [node('K', 0, 0)], 'down').edges[0];
    expect([e.from.side, e.to.side]).toEqual(['top', 'top']);
    // symmetric tie: child diagonal so bottom->top and right->left both have equal distance
    const d = run('nearest-sides', P, [node('K', 60, 40)], 'down').edges[0];
    // bottom(20,20)->top(80,40): ~63.2 ; right(40,10)->left(60,50): ~44.7 ; right wins on distance
    expect([d.from.side, d.to.side]).toEqual(['right', 'left']);
    const t = run('nearest-sides', node('A', 0, 0, 20, 20), [node('B', 40, 40, 20, 20)], 'down').edges[0];
    // bottom->left (10,20)->(40,50) and right->top (20,10)->(50,40) tie at 42.4; bottom comes first
    expect([t.from.side, t.to.side]).toEqual(['bottom', 'left']);
  });
  it('boundary points are collinear with both centres', () => {
    const k = node('K', 130, 70, 30, 50);
    const e = run('boundary', P, [k], 'none').edges[0];
    expect([e.from.side, e.to.side]).toEqual(['boundary', 'boundary']);
    const pc = { x: 20, y: 10 }, kc = { x: 145, y: 95 };
    const cross = (a: typeof pc, b: typeof pc, c: typeof pc) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    expect(Math.abs(cross(pc, kc, e.from))).toBeLessThan(1e-6);
    expect(Math.abs(cross(pc, kc, e.to))).toBeLessThan(1e-6);
    // from lies on the parent's border, to on the child's
    expect(e.from.x === 40 || e.from.y === 20).toBe(true);
    expect(e.to.x === 130 || e.to.y === 70).toBe(true);
  });
  it('every anchor returns one edge per child, in order', () => {
    const kids = [node('A', 0, 100), node('B', 100, 100), node('C', -100, 100)];
    for (const a of anchors) {
      const g = run(a.id, P, kids, 'down');
      expect(g.parent).toBe(P);
      expect(g.edges.map((e) => e.child.id)).toEqual(['A', 'B', 'C']);
    }
  });
  it('only fixed-sides has options', () => {
    expect(anchors.filter((a) => a.optionsSchema.length > 0).map((a) => a.id)).toEqual(['fixed-sides']);
    const f = anchors.find((a) => a.id === 'fixed-sides')!;
    expect(f.optionsSchema.map((o) => [o.key, o.default])).toEqual([['parentSide', 'bottom'], ['childSide', 'top']]);
  });
});
