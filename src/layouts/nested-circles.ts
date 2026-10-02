import { pack, packEnclose, packSiblings } from 'd3-hierarchy';
import type { TeamNode, TeamTree } from '../model/types';
import type { Ctx, NodeLayoutPlugin, NodeLayoutResult, PlacedNode, Rect } from '../plugins/types';
import { getNumber, getString } from '../plugins/options';
import { shapeRect, unionRects } from '../geometry/rect';
import { boxFor, fitLabel } from './label';
import { SIZING_OPTION, weightedHierarchy } from './containment';

/** A circle with its centre relative to its parent's centre (absolute for top-level teams). */
interface Circ { team: TeamNode; r: number; x: number; y: number; kids: Circ[] }

const MIN_R = 0.5;

/** Fit mode: leaves from their label, parents from the packed enclosure of their children. */
function fitCirc(team: TeamNode, padding: number, titleH: number, ctx: Ctx): Circ {
  if (team.children.length === 0) {
    return { team, r: ctx.measure(team.name, ctx.fontSize).width / 2 + padding, x: 0, y: 0, kids: [] };
  }
  const kids = team.children.map((c) => fitCirc(c, padding, titleH, ctx));
  packSiblings(kids);
  const e = packEnclose(kids)!;
  // children sit titleH/2 below the parent centre; the extra titleH of radius keeps them inside
  for (const k of kids) {
    k.x -= e.x;
    k.y = k.y - e.y + titleH / 2;
  }
  return { team, r: e.r + padding + titleH, x: 0, y: 0, kids };
}

function scale(c: Circ, k: number): void {
  c.x *= k;
  c.y *= k;
  c.r *= k;
  c.kids.forEach((m) => scale(m, k));
}

/** Uniformly shrink the children about the parent centre until they all fit (no-op when they already do). */
function containKids(c: Circ): void {
  let k = 1;
  for (const m of c.kids) k = Math.min(k, c.r / (Math.hypot(m.x, m.y) + m.r));
  if (k < 1) c.kids.forEach((m) => scale(m, k));
  c.kids.forEach(containKids);
}

export const nestedCircles: NodeLayoutPlugin = {
  id: 'nested-circles',
  name: 'Nested circles',
  optionsSchema: [
    SIZING_OPTION,
    { key: 'padding', label: 'Padding', type: 'number', min: 0, max: 40, step: 1, default: 6 },
  ],
  run(tree: TeamTree, options, ctx): NodeLayoutResult {
    const sizing = getString(options, 'sizing');
    const padding = getNumber(options, 'padding');
    const titleH = boxFor('X', ctx).h;
    let tops: Circ[] = [];

    if (sizing === 'fit') {
      tops = tree.roots.map((t) => fitCirc(t, padding, titleH, ctx));
      packSiblings(tops);
    } else if (tree.roots.length > 0) {
      let area = 0;
      const root = weightedHierarchy(tree, sizing);
      root.leaves().forEach((l) => {
        const w = ctx.measure(l.data.team!.name, ctx.fontSize).width / 2;
        area += 4 * w * w;
      });
      const S = Math.max(1, Math.sqrt(area));
      const laid = pack<(typeof root)['data']>().size([S, S]).padding(padding)(root);
      const conv = (n: typeof laid, px: number, py: number): Circ => ({
        team: n.data.team!,
        r: Number.isFinite(n.r) && n.r > 0 ? n.r : MIN_R,
        x: n.x - px,
        y: n.y - py,
        kids: (n.children ?? []).map((c) => conv(c, n.x, n.y)),
      });
      tops = (laid.children ?? []).map((c) => conv(c, 0, 0));
      tops.forEach(containKids);
    }

    const nodes: PlacedNode[] = [];
    const emit = (c: Circ, depth: number, parentId: string | null, cx: number, cy: number): void => {
      const parent = c.kids.length > 0;
      const maxW = Math.max(0, 2 * c.r - 2 * padding);
      nodes.push({
        id: c.team.id,
        name: c.team.name,
        depth,
        parentId,
        hiddenDescendants: c.team.hiddenDescendants,
        stacked: false,
        shape: { kind: 'circle', cx, cy, r: c.r },
        label: {
          text: fitLabel(c.team.name, maxW, ctx),
          x: cx,
          y: parent ? cy - c.r + padding + titleH / 2 : cy,
          anchor: 'middle',
          rotate: 0,
        },
      });
      c.kids.forEach((k) => emit(k, depth + 1, c.team.id, cx + k.x, cy + k.y));
    };
    tops.forEach((t) => emit(t, 1, null, t.x, t.y));

    // translate so the bounds' top-left is the origin
    const b0 = unionRects(nodes.map((n) => shapeRect(n.shape)));
    for (const n of nodes) {
      if (n.shape.kind !== 'circle') continue;
      n.shape.cx -= b0.x;
      n.shape.cy -= b0.y;
      n.label.x -= b0.x;
      n.label.y -= b0.y;
    }
    const bounds: Rect = unionRects(nodes.map((n) => shapeRect(n.shape)));
    return { nodes, bounds, direction: 'none', hasEdges: false, origin: null };
  },
};
