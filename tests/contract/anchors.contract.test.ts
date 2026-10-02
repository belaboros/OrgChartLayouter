import { describe, it, expect } from 'vitest';
import { anchors } from '../../src/anchors/registry';
import { sidePoint } from '../../src/anchors/geometry';
import { layouts, findPlugin } from '../../src/layouts/registry';
import { shapeCenter } from '../../src/geometry/rect';
import { fakeCtx } from '../helpers/fake-measure';
import { CONTRACT_TREES } from '../helpers/trees';
import { optionVariants } from '../helpers/variants';
import { groupsFor } from '../helpers/groups';
import type { AnchorPoint, Shape, Side } from '../../src/plugins/types';

const near = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

function onOutline(p: { x: number; y: number }, s: Shape): boolean {
  if (s.kind !== 'rect') return near(Math.hypot(p.x - s.cx, p.y - s.cy), s.r, 0.5);
  const inX = p.x >= s.x - 0.5 && p.x <= s.x + s.w + 0.5;
  const inY = p.y >= s.y - 0.5 && p.y <= s.y + s.h + 0.5;
  return (
    (inX && (near(p.y, s.y, 0.5) || near(p.y, s.y + s.h, 0.5))) ||
    (inY && (near(p.x, s.x, 0.5) || near(p.x, s.x + s.w, 0.5)))
  );
}

function check(pt: AnchorPoint, shape: Shape, what: string) {
  if (pt.side === 'center') {
    const c = shapeCenter(shape);
    expect(near(pt.x, c.x, 0.01) && near(pt.y, c.y, 0.01), `${what} is not the centre`).toBe(true);
  } else if (pt.side === 'boundary') {
    expect(onOutline(pt, shape), `${what} is not on the outline`).toBe(true);
  } else {
    const e = sidePoint(shape, pt.side as Side);
    expect(near(pt.x, e.x, 0.01) && near(pt.y, e.y, 0.01), `${what} is not the ${pt.side} point`).toBe(true);
  }
}

describe('anchor contract', () => {
  it('registry is non-empty with unique ids', () => {
    expect(anchors.length).toBeGreaterThan(0);
    expect(new Set(anchors.map((a) => a.id)).size).toBe(anchors.length);
  });

  const trees = CONTRACT_TREES.filter((t) => t.name === 'small' || t.name === 'medium');
  const layoutIds = ['top-down', 'compact', 'radial'];
  for (const anchor of anchors) {
    describe(anchor.id, () => {
      for (const layoutId of layoutIds) {
        const layout = findPlugin(layouts, layoutId)!;
        const layoutVariants = layoutId === 'radial' ? optionVariants(layout.optionsSchema) : [optionVariants(layout.optionsSchema)[0]];
        for (const lo of layoutVariants) {
          for (const { name, tree } of trees) {
            for (const [vi, ao] of optionVariants(anchor.optionsSchema).entries()) {
              it(`${layoutId} ${JSON.stringify(lo)} / ${name} / anchor variant ${vi}`, () => {
                const result = layout.run(tree, lo, fakeCtx);
                const groups = groupsFor(result);
                expect(groups.length).toBeGreaterThan(0);
                for (const { parent, children } of groups) {
                  const g = anchor.run({ parent, children, direction: result.direction }, ao, fakeCtx);
                  expect(g.parent).toBe(parent);
                  expect(g.edges).toHaveLength(children.length);
                  g.edges.forEach((e, i) => {
                    expect(e.child).toBe(children[i]);
                    check(e.from, parent.shape, `from of ${parent.id}->${e.child.id}`);
                    check(e.to, e.child.shape, `to of ${parent.id}->${e.child.id}`);
                  });
                }
              });
            }
          }
        }
      }
    });
  }
});
