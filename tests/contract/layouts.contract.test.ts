import { describe, it, expect } from 'vitest';
import { layouts } from '../../src/layouts/registry';
import { limitDepth } from '../../src/pipeline/depth';
import { countTeams } from '../../src/model/tree';
import type { TeamNode } from '../../src/model/types';
import { fakeCtx } from '../helpers/fake-measure';
import { CONTRACT_TREES } from '../helpers/trees';
import { optionVariants } from '../helpers/variants';
import { contains, overlaps } from '../helpers/geometry';

interface Src { node: TeamNode; depth: number; parentId: string | null }

function indexTree(roots: TeamNode[]): Map<string, Src> {
  const byId = new Map<string, Src>();
  const walk = (nodes: TeamNode[], depth: number, parentId: string | null) => {
    for (const node of nodes) {
      byId.set(node.id, { node, depth, parentId });
      walk(node.children, depth + 1, node.id);
    }
  };
  walk(roots, 1, null);
  return byId;
}

describe('layout contract', () => {
  it('registry is non-empty with unique ids', () => {
    expect(layouts.length).toBeGreaterThan(0);
    expect(new Set(layouts.map((l) => l.id)).size).toBe(layouts.length);
  });

  for (const layout of layouts) {
    describe(layout.id, () => {
      const variants = optionVariants(layout.optionsSchema);
      for (const { name, tree } of CONTRACT_TREES) {
        for (const [vi, options] of variants.entries()) {
          for (const maxDepth of [null, 1, 3]) {
            it(`${name} / variant ${vi} ${JSON.stringify(options)} / depth ${maxDepth}`, () => {
              const limited = limitDepth(tree, maxDepth);
              const byId = indexTree(limited.roots);
              const result = layout.run(limited, options, fakeCtx);

              expect(result.nodes).toHaveLength(countTeams(limited));
              expect(new Set(result.nodes.map((n) => n.id)).size).toBe(result.nodes.length);

              const placed = new Map(result.nodes.map((n) => [n.id, n]));
              const boundsShape = { kind: 'rect' as const, ...result.bounds };
              for (const key of ['x', 'y', 'w', 'h'] as const) expect(Number.isFinite(result.bounds[key])).toBe(true);

              for (const n of result.nodes) {
                const src = byId.get(n.id);
                expect(src, `unknown id ${n.id}`).toBeDefined();
                expect([n.depth, n.parentId, n.hiddenDescendants]).toEqual([
                  src!.depth,
                  src!.parentId,
                  src!.node.hiddenDescendants,
                ]);
                expect(n.name).toBe(src!.node.name);
                expect(typeof n.stacked).toBe('boolean');
                const nums = Object.values(n.shape).filter((v) => typeof v === 'number');
                expect(nums.length).toBeGreaterThan(0);
                expect(nums.every(Number.isFinite)).toBe(true);
                expect(
                  [n.label.x, n.label.y, n.label.rotate].every(Number.isFinite),
                  `label of ${n.id} is not finite`,
                ).toBe(true);
                expect(contains(boundsShape, n.shape), `${n.id} outside bounds`).toBe(true);
              }

              const bad: string[] = [];
              if (result.hasEdges) {
                for (let i = 0; i < result.nodes.length; i++) {
                  for (let j = i + 1; j < result.nodes.length; j++) {
                    const a = result.nodes[i];
                    const b = result.nodes[j];
                    if (overlaps(a.shape, b.shape)) bad.push(`${a.id} overlaps ${b.id}`);
                  }
                }
              } else {
                const kids = new Map<string | null, typeof result.nodes>();
                for (const n of result.nodes) {
                  const list = kids.get(n.parentId) ?? [];
                  list.push(n);
                  kids.set(n.parentId, list);
                  if (n.parentId !== null && !contains(placed.get(n.parentId)!.shape, n.shape)) {
                    bad.push(`${n.id} not inside parent`);
                  }
                }
                for (const sibs of kids.values()) {
                  for (let i = 0; i < sibs.length; i++) {
                    for (let j = i + 1; j < sibs.length; j++) {
                      if (overlaps(sibs[i].shape, sibs[j].shape)) bad.push(`siblings ${sibs[i].id} / ${sibs[j].id} overlap`);
                    }
                  }
                }
              }
              expect(bad.slice(0, 5)).toEqual([]);
            });
          }
        }
      }
    });
  }
});
