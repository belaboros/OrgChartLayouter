import type { TeamNode, TeamTree } from '../../src/model/types';

/** Breadth-first balanced tree of `count` teams named T0..T<count-1>; each team has at most `branching` children. */
export function generateTree(count: number, branching: number): TeamTree {
  const nodes: TeamNode[] = Array.from({ length: count }, (_, i) => ({
    id: `T${i}`, name: `T${i}`, children: [], line: i + 1, hiddenDescendants: 0,
  }));
  for (let i = 1; i < count; i++) nodes[Math.floor((i - 1) / branching)].children.push(nodes[i]);
  return { roots: count > 0 ? [nodes[0]] : [] };
}
