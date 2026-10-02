import { describe, it, expect } from 'vitest';
import { routers } from '../../src/routers/registry';
import { anchors } from '../../src/anchors/registry';
import { layouts, findPlugin } from '../../src/layouts/registry';
import { fakeCtx } from '../helpers/fake-measure';
import { CONTRACT_TREES } from '../helpers/trees';
import { optionVariants } from '../helpers/variants';
import { groupsFor } from '../helpers/groups';
import { parsePath } from '../helpers/svg-path';

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

describe('router contract', () => {
  it('registry is non-empty with unique ids', () => {
    expect(routers.length).toBeGreaterThan(0);
    expect(new Set(routers.map((r) => r.id)).size).toBe(routers.length);
  });

  const { tree } = CONTRACT_TREES.find((t) => t.name === 'medium')!;
  const layoutIds = ['top-down', 'left-right', 'compact', 'radial'];
  for (const router of routers) {
    describe(router.id, () => {
      for (const anchor of anchors) {
        for (const layoutId of layoutIds) {
          const layout = findPlugin(layouts, layoutId)!;
          const result = layout.run(tree, optionVariants(layout.optionsSchema)[0], fakeCtx);
          const groups = groupsFor(result);
          for (const [vi, ro] of optionVariants(router.optionsSchema).entries()) {
            it(`${anchor.id} / ${layoutId} / router variant ${vi}`, () => {
              expect(groups.length).toBeGreaterThan(0);
              for (const { parent, children } of groups) {
                const g = anchor.run({ parent, children, direction: result.direction }, optionVariants(anchor.optionsSchema)[0], fakeCtx);
                const paths = router.run({ group: g, direction: result.direction, origin: result.origin }, ro, fakeCtx);
                expect(paths).toHaveLength(g.edges.length);
                const sideAnchors = g.edges.every((e) => e.from.side !== 'center' && e.from.side !== 'boundary' && e.to.side !== 'center' && e.to.side !== 'boundary');
                paths.forEach((p, i) => {
                  const e = g.edges[i];
                  expect(p.fromId).toBe(parent.id);
                  expect(p.toId).toBe(e.child.id);
                  const segs = parsePath(p.d);
                  expect(segs[0].cmd).toBe('M');
                  expect(segs.every((s) => 'MLQ'.includes(s.cmd))).toBe(true);
                  const all = segs.flatMap((s) => s.pts);
                  expect(all.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
                  expect(near(all[0].x, e.from.x) && near(all[0].y, e.from.y), `start of ${p.fromId}->${p.toId}`).toBe(true);
                  const last = all[all.length - 1];
                  expect(near(last.x, e.to.x) && near(last.y, e.to.y), `end of ${p.fromId}->${p.toId}`).toBe(true);
                  if (router.id.startsWith('orthogonal-') && ro.cornerRadius === 0 && sideAnchors) {
                    let prev = segs[0].pts[0];
                    for (const s of segs.slice(1)) {
                      const q = s.pts[s.pts.length - 1];
                      if (s.cmd === 'L') {
                        expect(Math.abs(q.x - prev.x) < 0.01 || Math.abs(q.y - prev.y) < 0.01, `diagonal in ${p.d}`).toBe(true);
                      }
                      prev = q;
                    }
                  }
                });
              }
            });
          }
        }
      }
    });
  }
});
