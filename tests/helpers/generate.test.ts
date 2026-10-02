import { describe, expect, it } from 'vitest';
import type { TeamNode } from '../../src/model/types';
import { generateTree } from './generate';

function all(n: TeamNode): TeamNode[] { return [n, ...n.children.flatMap(all)]; }

describe('generateTree', () => {
  const tree = generateTree(1000, 6);
  const nodes = tree.roots.flatMap(all);

  it('produces exactly n teams under one root', () => {
    expect(tree.roots).toHaveLength(1);
    expect(nodes).toHaveLength(1000);
  });
  it('respects the branching factor and fills breadth-first', () => {
    expect(Math.max(...nodes.map((n) => n.children.length))).toBe(6);
    expect(tree.roots[0].children.map((c) => c.name)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6']);
    expect(tree.roots[0].children[0].children[0].name).toBe('T7');
  });
  it('has unique names and ids', () => {
    expect(new Set(nodes.map((n) => n.name)).size).toBe(1000);
    expect(new Set(nodes.map((n) => n.id)).size).toBe(1000);
  });
  it('handles an empty tree', () => {
    expect(generateTree(0, 3).roots).toEqual([]);
  });
});
