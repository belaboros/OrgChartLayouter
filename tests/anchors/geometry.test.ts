import { describe, it, expect } from 'vitest';
import { sidePoint, boundaryPoint } from '../../src/anchors/geometry';
import type { Shape, Side } from '../../src/plugins/types';

const R: Shape = { kind: 'rect', x: 0, y: 0, w: 40, h: 20 };
const C: Shape = { kind: 'circle', cx: 0, cy: 0, r: 10 };
const D: Shape = { kind: 'dot', cx: 5, cy: 5, r: 4 };

describe('anchor geometry', () => {
  it('rect side midpoints', () =>
    expect((['top', 'bottom', 'left', 'right'] as Side[]).map((s) => sidePoint(R, s))).toEqual([
      { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 10 }, { x: 40, y: 10 },
    ]));
  it('circle side points', () =>
    expect((['top', 'bottom', 'left', 'right'] as Side[]).map((s) => sidePoint(C, s))).toEqual([
      { x: 0, y: -10 }, { x: 0, y: 10 }, { x: -10, y: 0 }, { x: 10, y: 0 },
    ]));
  it('dot side points are on the dot circle', () => {
    expect(sidePoint(D, 'top')).toEqual({ x: 5, y: 1 });
    expect(sidePoint(D, 'left')).toEqual({ x: 1, y: 5 });
  });
  it('rect boundary toward a far point on the diagonal hits the corner', () =>
    expect(boundaryPoint(R, { x: 60, y: 30 })).toEqual({ x: 40, y: 20 }));
  it('rect boundary hits the correct side for off-diagonal targets', () => {
    expect(boundaryPoint(R, { x: 20, y: 100 })).toEqual({ x: 20, y: 20 });
    expect(boundaryPoint(R, { x: -100, y: 10 })).toEqual({ x: 0, y: 10 });
    const p = boundaryPoint(R, { x: 120, y: 30 }); // slope 0.2 -> exits the right edge
    expect(p.x).toBeCloseTo(40);
    expect(p.y).toBeCloseTo(14);
    const q = boundaryPoint(R, { x: 30, y: -90 }); // steep -> exits the top edge
    expect(q.y).toBeCloseTo(0);
    expect(q.x).toBeCloseTo(21);
  });
  it('circle boundary', () => {
    const p = boundaryPoint(C, { x: 30, y: 40 });
    expect([p.x, p.y]).toEqual([6, 8]);
  });
  it('boundary of a target equal to the centre is the centre', () => {
    expect(boundaryPoint(R, { x: 20, y: 10 })).toEqual({ x: 20, y: 10 });
    expect(boundaryPoint(C, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});
