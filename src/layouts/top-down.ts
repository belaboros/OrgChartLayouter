import { flextree } from 'd3-flextree';
import type { TeamNode, TeamTree } from '../model/types';
import type { NodeLayoutPlugin, NodeLayoutResult, PlacedNode, Rect } from '../plugins/types';
import { getNumber } from '../plugins/options';
import { unionRects } from '../geometry/rect';
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

export const topDown: NodeLayoutPlugin = {
  id: 'top-down',
  name: 'Top-down',
  optionsSchema: [
    { key: 'siblingGap', label: 'Sibling gap', type: 'number', min: 0, max: 80, step: 1, default: 16 },
    { key: 'levelGap', label: 'Level gap', type: 'number', min: 10, max: 150, step: 1, default: 40 },
  ],
  run(tree: TeamTree, options, ctx): NodeLayoutResult {
    const siblingGap = getNumber(options, 'siblingGap');
    const levelGap = getNumber(options, 'levelGap');

    const root: Item = { team: null, depth: 0, parentId: null, children: tree.roots.map((r) => toItem(r, 1, null)) };
    const layout = flextree<Item>({
      children: (d: Item) => d.children,
      nodeSize: (n: { data: Item }): [number, number] => {
        if (n.data.team === null) return [0, 0];
        const b = boxFor(n.data.team.name, ctx);
        return [b.w + siblingGap, b.h + levelGap];
      },
      spacing: 0,
    });
    const laid = layout(layout.hierarchy(root));

    const nodes: PlacedNode[] = [];
    laid.each((n) => {
      const team = n.data.team;
      if (team === null) return;
      const { w, h } = boxFor(team.name, ctx);
      const x = (n as unknown as { x: number }).x - w / 2;
      const y = (n as unknown as { y: number }).y;
      nodes.push({
        id: team.id,
        name: team.name,
        depth: n.data.depth,
        parentId: n.data.parentId,
        hiddenDescendants: team.hiddenDescendants,
        stacked: false,
        shape: { kind: 'rect', x, y, w, h },
        label: { text: team.name, x: x + w / 2, y: y + h / 2, anchor: 'middle', rotate: 0 },
      });
    });

    const bounds: Rect = unionRects(nodes.map((n) => n.shape as Rect));
    return { nodes, bounds, direction: 'down', hasEdges: true, origin: null };
  },
};
