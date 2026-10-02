import type { TeamNode, TeamTree } from './types';

export function treeDepth(tree: TeamTree): number {
  if (tree.roots.length === 0) return 0;

  function maxDepthOfNode(node: TeamNode): number {
    if (node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(child => maxDepthOfNode(child)));
  }

  return Math.max(...tree.roots.map(root => maxDepthOfNode(root)));
}

export function countTeams(tree: TeamTree): number {
  function countNode(node: TeamNode): number {
    return 1 + node.children.reduce((sum, child) => sum + countNode(child), 0);
  }

  return tree.roots.reduce((sum, root) => sum + countNode(root), 0);
}
