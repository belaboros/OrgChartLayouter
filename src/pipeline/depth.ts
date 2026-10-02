import type { TeamNode, TeamTree } from '../model/types';

function countAllDescendants(node: TeamNode): number {
  return node.children.reduce((sum, child) => 1 + sum + countAllDescendants(child), 0);
}

function limitDepthNode(node: TeamNode, currentDepth: number, maxDepth: number | null): TeamNode {
  if (maxDepth === null) {
    // Deep copy everything, preserving all properties
    return {
      ...node,
      children: node.children.map(child => limitDepthNode(child, currentDepth + 1, null)),
    };
  }

  if (currentDepth >= maxDepth) {
    // At or past the limit, cut off all children
    return {
      ...node,
      children: [],
      hiddenDescendants: countAllDescendants(node),
    };
  }

  // Below the limit, recurse on children
  return {
    ...node,
    children: node.children.map(child => limitDepthNode(child, currentDepth + 1, maxDepth)),
    hiddenDescendants: 0,
  };
}

export function limitDepth(tree: TeamTree, maxDepth: number | null): TeamTree {
  return {
    roots: tree.roots.map(root => limitDepthNode(root, 1, maxDepth)),
  };
}
