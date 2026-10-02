import type { TeamNode, TeamTree } from '../model/types';
import type { Ctx, NodeLayoutPlugin, NodeLayoutResult, PlacedNode, Rect } from '../plugins/types';
import { getNumber } from '../plugins/options';
import { unionRects } from '../geometry/rect';
import { boxFor } from './label';

/** A laid-out subtree in block-local coordinates; x starts at 0, y = 0 is the top of the parent box. */
interface Block {
  nodes: PlacedNode[];
  width: number;
  cx: number; // x of the parent's centre within the block
}

function place(team: TeamNode, depth: number, parentId: string | null, x: number, y: number, stacked: boolean, ctx: Ctx): PlacedNode {
  const { w, h } = boxFor(team.name, ctx);
  return {
    id: team.id,
    name: team.name,
    depth,
    parentId,
    hiddenDescendants: team.hiddenDescendants,
    stacked,
    shape: { kind: 'rect', x, y, w, h },
    label: { text: team.name, x: x + w / 2, y: y + h / 2, anchor: 'middle', rotate: 0 },
  };
}

function shift(nodes: PlacedNode[], dx: number, dy: number): void {
  for (const n of nodes) {
    if (n.shape.kind === 'rect') {
      n.shape.x += dx;
      n.shape.y += dy;
    }
    n.label.x += dx;
    n.label.y += dy;
  }
}

/** Re-bases a block so its leftmost extent is at x = 0. */
function normalize(nodes: PlacedNode[], cx: number): Block {
  const r = unionRects(nodes.map((n) => n.shape as Rect));
  shift(nodes, -r.x, 0);
  return { nodes, width: r.w, cx: cx - r.x };
}

/** Lays children side by side; returns the nodes and the span centre of the first and last child. */
function sideBySide(blocks: Block[], siblingGap: number, dy: number): { nodes: PlacedNode[]; cx: number } {
  const nodes: PlacedNode[] = [];
  let x = 0;
  let first = 0;
  let last = 0;
  blocks.forEach((b, i) => {
    shift(b.nodes, x, dy);
    if (i === 0) first = x + b.cx;
    last = x + b.cx;
    nodes.push(...b.nodes);
    x += b.width + siblingGap;
  });
  return { nodes, cx: (first + last) / 2 };
}

function layoutTeam(team: TeamNode, depth: number, parentId: string | null, ctx: Ctx, gaps: Gaps): Block {
  const parent = place(team, depth, parentId, 0, 0, false, ctx);
  const pw = (parent.shape as Rect).w;
  const ph = (parent.shape as Rect).h;
  if (team.children.length === 0) return normalize([parent], pw / 2);

  const { siblingGap, levelGap, maxPerColumn } = gaps;
  if (team.children.every((c) => c.children.length === 0)) {
    const leaves = team.children;
    const n = leaves.length;
    const k = Math.ceil(n / maxPerColumn);
    const left = Math.floor(k / 2);
    const base = Math.floor(n / k);
    const extra = n % k;
    const nodes: PlacedNode[] = [parent];
    const cols: { x: number; w: number }[] = [];
    // First lay out in visual order with local column widths.
    const sizes = Array.from({ length: k }, (_, c) => base + (c < extra ? 1 : 0));
    const boxes = leaves.map((l) => boxFor(l.name, ctx));
    const colBoxes: number[][] = [];
    let idx = 0;
    for (const s of sizes) {
      colBoxes.push(Array.from({ length: s }, () => idx++));
    }
    const widths = colBoxes.map((ids) => Math.max(...ids.map((i) => boxes[i].w)));
    // Trunk at x = 0. Left columns go outward right to left; right columns go outward left to right.
    let edge = -siblingGap;
    for (let c = left - 1; c >= 0; c--) {
      cols[c] = { x: edge - widths[c], w: widths[c] };
      edge -= widths[c] + siblingGap;
    }
    edge = siblingGap;
    for (let c = left; c < k; c++) {
      cols[c] = { x: edge, w: widths[c] };
      edge += widths[c] + siblingGap;
    }
    colBoxes.forEach((ids, c) => {
      let y = ph + levelGap;
      for (const i of ids) {
        nodes.push(place(leaves[i], depth + 1, team.id, cols[c].x, y, true, ctx));
        y += boxes[i].h + siblingGap;
      }
    });
    shift([parent], -pw / 2, 0);
    return normalize(nodes, 0);
  }

  const blocks = team.children.map((c) => layoutTeam(c, depth + 1, team.id, ctx, gaps));
  const row = sideBySide(blocks, siblingGap, ph + levelGap);
  shift([parent], row.cx - pw / 2, 0);
  return normalize([parent, ...row.nodes], row.cx);
}

interface Gaps { siblingGap: number; levelGap: number; maxPerColumn: number }

export const compact: NodeLayoutPlugin = {
  id: 'compact',
  name: 'Compact',
  optionsSchema: [
    { key: 'siblingGap', label: 'Sibling gap', type: 'number', min: 0, max: 80, step: 1, default: 16 },
    { key: 'levelGap', label: 'Level gap', type: 'number', min: 10, max: 150, step: 1, default: 40 },
    { key: 'maxPerColumn', label: 'Max per column', type: 'number', min: 1, max: 50, step: 1, default: 8 },
  ],
  run(tree: TeamTree, options, ctx): NodeLayoutResult {
    const gaps: Gaps = {
      siblingGap: getNumber(options, 'siblingGap'),
      levelGap: getNumber(options, 'levelGap'),
      maxPerColumn: Math.max(1, Math.floor(getNumber(options, 'maxPerColumn'))),
    };
    const blocks = tree.roots.map((r) => layoutTeam(r, 1, null, ctx, gaps));
    const nodes = sideBySide(blocks, gaps.siblingGap, 0).nodes;
    const bounds: Rect = unionRects(nodes.map((n) => n.shape as Rect));
    return { nodes, bounds, direction: 'down', hasEdges: true, origin: null };
  },
};
