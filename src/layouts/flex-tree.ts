import { flextree } from 'd3-flextree';
import type { TeamNode, TeamTree } from '../model/types';
import type { Ctx, PlacedNode, Rect } from '../plugins/types';
import { boxFor } from './label';

interface Item {
  team: TeamNode | null; // null = invisible root
  depth: number;
  parentId: string | null;
  children: Item[];
}

function toItem(team: TeamNode, depth: number, parentId: string | null): Item {
  return { team, depth, parentId, children: team.children.map((c) => toItem(c, depth + 1, team.id)) };
}

/**
 * Runs flextree over the team forest (under an invisible root) and places every team.
 * Top-down: flextree x = horizontal centre, flextree y = top edge.
 * Left-right: flextree x = vertical centre, flextree y = left edge (axes swapped).
 */
export function flexLayout(
  tree: TeamTree,
  ctx: Ctx,
  siblingGap: number,
  levelGap: number,
  horizontal: boolean,
): PlacedNode[] {
  const root: Item = { team: null, depth: 0, parentId: null, children: tree.roots.map((r) => toItem(r, 1, null)) };
  const layout = flextree<Item>({
    children: (d: Item) => d.children,
    nodeSize: (n: { data: Item }): [number, number] => {
      if (n.data.team === null) return [0, 0];
      const b = boxFor(n.data.team.name, ctx);
      return horizontal ? [b.h + siblingGap, b.w + levelGap] : [b.w + siblingGap, b.h + levelGap];
    },
    spacing: 0,
  });
  const laid = layout(layout.hierarchy(root));

  const nodes: PlacedNode[] = [];
  laid.each((n) => {
    const team = n.data.team;
    if (team === null) return;
    const { w, h } = boxFor(team.name, ctx);
    const fx = (n as unknown as { x: number }).x;
    const fy = (n as unknown as { y: number }).y;
    const x = horizontal ? fy : fx - w / 2;
    const y = horizontal ? fx - h / 2 : fy;
    const shape: Rect = { x, y, w, h };
    nodes.push({
      id: team.id,
      name: team.name,
      depth: n.data.depth,
      parentId: n.data.parentId,
      hiddenDescendants: team.hiddenDescendants,
      stacked: false,
      shape: { kind: 'rect', ...shape },
      label: { text: team.name, x: x + w / 2, y: y + h / 2, anchor: 'middle', rotate: 0 },
    });
  });
  return nodes;
}
