import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3-hierarchy';
import type { TeamNode, TeamTree } from '../model/types';
import type { Ctx, NodeLayoutPlugin, NodeLayoutResult, PlacedNode, Rect } from '../plugins/types';
import { getNumber, getString } from '../plugins/options';
import { unionRects } from '../geometry/rect';
import { BOX_PAD_X, boxFor, fitLabel } from './label';

export const ASPECTS: Record<string, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  A4: 1 / Math.SQRT2,
};

interface Sized { team: TeamNode; w: number; h: number; kids: Sized[]; offsets: { x: number; y: number }[]; contentW: number }
interface Datum { team?: TeamNode; weight: number; children?: Datum[] }

/** Greedy row wrapping in YAML order. Returns child offsets and the content size. */
function wrap(items: { w: number; h: number }[], padding: number, aspect: number) {
  const widest = Math.max(0, ...items.map((i) => i.w));
  const target = Math.max(widest, Math.sqrt(items.reduce((s, i) => s + i.w * i.h, 0) * aspect));
  const offsets: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  let contentW = 0;
  items.forEach((it, k) => {
    if (k > 0 && x + padding + it.w > target) {
      y += rowH + padding;
      x = 0;
      rowH = 0;
    } else if (k > 0) {
      x += padding;
    }
    offsets.push({ x, y });
    x += it.w;
    rowH = Math.max(rowH, it.h);
    contentW = Math.max(contentW, x);
  });
  return { offsets, contentW, contentH: items.length ? y + rowH : 0 };
}

function measure(team: TeamNode, padding: number, aspect: number, titleH: number, ctx: Ctx): Sized {
  if (team.children.length === 0) {
    const b = boxFor(team.name, ctx);
    return { team, w: b.w, h: b.h, kids: [], offsets: [], contentW: 0 };
  }
  const kids = team.children.map((c) => measure(c, padding, aspect, titleH, ctx));
  const { offsets, contentW, contentH } = wrap(kids, padding, aspect);
  const w = Math.max(contentW, boxFor(team.name, ctx).w) + 2 * padding;
  return { team, w, h: titleH + contentH + 2 * padding, kids, offsets, contentW };
}

export const nestedRects: NodeLayoutPlugin = {
  id: 'nested-rects',
  name: 'Nested rectangles',
  optionsSchema: [
    {
      key: 'sizing',
      label: 'Sizing',
      type: 'select',
      choices: [
        { value: 'fit', label: 'Fit to content' },
        { value: 'leaf-count', label: 'By leaf count' },
        { value: 'equal', label: 'Equal shares' },
      ],
      default: 'fit',
    },
    { key: 'padding', label: 'Padding', type: 'number', min: 0, max: 40, step: 1, default: 8 },
    {
      key: 'aspect',
      label: 'Aspect',
      type: 'select',
      choices: Object.keys(ASPECTS).map((k) => ({ value: k, label: k })),
      default: '16:9',
    },
  ],
  run(tree: TeamTree, options, ctx): NodeLayoutResult {
    const sizing = getString(options, 'sizing');
    const padding = getNumber(options, 'padding');
    const aspect = ASPECTS[getString(options, 'aspect')] ?? ASPECTS['16:9'];
    const titleH = boxFor('X', ctx).h;
    const nodes: PlacedNode[] = [];

    const place = (team: TeamNode, depth: number, parentId: string | null, r: Rect): void => {
      const parent = team.children.length > 0;
      const inner = Math.max(0, parent ? r.w - 2 * padding - 2 * BOX_PAD_X : r.w - 2 * BOX_PAD_X);
      nodes.push({
        id: team.id,
        name: team.name,
        depth,
        parentId,
        hiddenDescendants: team.hiddenDescendants,
        stacked: false,
        shape: { kind: 'rect', ...r },
        label: parent
          ? { text: fitLabel(team.name, inner, ctx), x: r.x + padding + BOX_PAD_X, y: r.y + padding + titleH / 2, anchor: 'start', rotate: 0 }
          : { text: fitLabel(team.name, inner, ctx), x: r.x + r.w / 2, y: r.y + r.h / 2, anchor: 'middle', rotate: 0 },
      });
    };

    if (sizing === 'fit') {
      const tops = tree.roots.map((t) => measure(t, padding, aspect, titleH, ctx));
      const { offsets } = wrap(tops, padding, aspect);
      const emit = (s: Sized, depth: number, parentId: string | null, x: number, y: number): void => {
        place(s.team, depth, parentId, { x, y, w: s.w, h: s.h });
        s.kids.forEach((k, i) =>
          emit(k, depth + 1, s.team.id, x + padding + s.offsets[i].x, y + padding + titleH + s.offsets[i].y),
        );
      };
      tops.forEach((t, i) => emit(t, 1, null, offsets[i].x, offsets[i].y));
    } else if (tree.roots.length > 0) {
      const toDatum = (t: TeamNode, weight: number): Datum => ({
        team: t,
        weight,
        children: t.children.map((c) => toDatum(c, weight / t.children.length)),
      });
      const rootDatum: Datum = { weight: 1, children: tree.roots.map((t) => toDatum(t, 1 / tree.roots.length)) };
      const root = hierarchy<Datum>(rootDatum, (d) => d.children && d.children.length ? d.children : undefined);
      root.sum((d) => (d.children && d.children.length ? 0 : sizing === 'equal' ? d.weight : 1));
      let leafArea = 0;
      root.leaves().forEach((l) => {
        const b = boxFor(l.data.team!.name, ctx);
        leafArea += b.w * b.h;
      });
      const W = Math.max(1, Math.sqrt(2 * leafArea * aspect));
      const laid = treemap<Datum>()
        .tile(treemapSquarify)
        .size([W, W / aspect])
        .paddingInner(padding)
        .paddingOuter(padding)
        .paddingTop((n) => (n.depth > 0 && n.children ? titleH + padding : padding))(root);

      const visit = (n: HierarchyRectangularNode<Datum>, depth: number, parentId: string | null, inside: Rect): void => {
        // clamp into the parent's inner box (guards against d3 collapse of negative sizes)
        const x0 = Math.min(Math.max(n.x0!, inside.x), inside.x + inside.w);
        const y0 = Math.min(Math.max(n.y0!, inside.y), inside.y + inside.h);
        const x1 = Math.min(Math.max(n.x1!, x0), inside.x + inside.w);
        const y1 = Math.min(Math.max(n.y1!, y0), inside.y + inside.h);
        const r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        place(n.data.team!, depth, parentId, r);
        (n.children ?? []).forEach((c) => visit(c, depth + 1, n.data.team!.id, r));
      };
      (laid.children ?? []).forEach((c) => visit(c, 1, null, { x: 0, y: 0, w: W, h: W / aspect }));
    }

    const bounds: Rect = unionRects(nodes.map((n) => n.shape as Rect));
    return { nodes, bounds, direction: 'none', hasEdges: false, origin: null };
  },
};
