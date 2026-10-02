import { describe, it, expect } from 'vitest';
import { shapeRect, shapeCenter, unionRects } from '../../src/geometry/rect';

describe('rect', () => {
  it('shapeRect of a circle', () => expect(shapeRect({ kind: 'circle', cx: 10, cy: 10, r: 5 })).toEqual({ x: 5, y: 5, w: 10, h: 10 }));
  it('shapeRect of a dot matches circle', () => expect(shapeRect({ kind: 'dot', cx: 10, cy: 10, r: 5 })).toEqual({ x: 5, y: 5, w: 10, h: 10 }));
  it('shapeRect of a rect is itself', () => expect(shapeRect({ kind: 'rect', x: 1, y: 2, w: 3, h: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4 }));
  it('shapeCenter', () => {
    expect(shapeCenter({ kind: 'rect', x: 0, y: 0, w: 10, h: 4 })).toEqual({ x: 5, y: 2 });
    expect(shapeCenter({ kind: 'dot', cx: 7, cy: 8, r: 1 })).toEqual({ x: 7, y: 8 });
  });
  it('unionRects', () => expect(unionRects([{ x: 0, y: 0, w: 1, h: 1 }, { x: 5, y: -2, w: 1, h: 1 }])).toEqual({ x: 0, y: -2, w: 6, h: 3 }));
  it('unionRects of empty list', () => expect(unionRects([])).toEqual({ x: 0, y: 0, w: 0, h: 0 }));
});
