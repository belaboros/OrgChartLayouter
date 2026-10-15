import { hierarchy, tree as d3tree, type HierarchyNode } from 'd3-hierarchy';
import type { TeamNode, TeamTree } from '../model/types';
import type { NodeLayoutPlugin, NodeLayoutResult, PlacedNode, Rect } from '../plugins/types';
import { getNumber, getString } from '../plugins/options';
import { shapeRect, unionRects } from '../geometry/rect';
import { boxFor, labelExtent } from './label';

const DOT_R = 4;
const DOT_LABEL_OFFSET = 8;
/** Clear space between the end of a dot label and the next ring out. */
const LABEL_MARGIN = 12;
const GAP = 4;
const TWO_PI = 2 * Math.PI;
/** Boxes mode re-places the tree this many times after the first pass, each time spacing angles by the previous pass's needs. */
const BOX_REFINE_PASSES = 4;

interface Item { team: TeamNode; depth: number; parentId: string | null; theta: number; ext: number; w: number; h: number; labelW: number }
interface Datum { team?: TeamNode; children?: Datum[] }

/** Normalises a label rotation in degrees into (-90, 90]. */
function readableRotation(deg: number): number {
  const d = ((deg % 360) + 360) % 360;
  if (d > 270) return d - 360;
  if (d > 90) return d - 180;
  return d;
}

/**
 * Chord length that keeps two neighbours on one ring apart. The chord is perpendicular to the ray at
 * their mid angle, so axis-aligned boxes only need to clear along x or along y: wide boxes stacked at
 * the sides of the circle need just their heights, not their diagonals.
 */
function chordNeeded(a: Item, b: Item, mid: number, boxes: boolean): number {
  if (!boxes) return a.ext / 2 + b.ext / 2 + GAP;
  const sin = Math.abs(Math.sin(mid));
  const cos = Math.abs(Math.cos(mid));
  const alongX = sin > 1e-9 ? ((a.w + b.w) / 2 + GAP) / sin : Infinity;
  const alongY = cos > 1e-9 ? ((a.h + b.h) / 2 + GAP) / cos : Infinity;
  return Math.min(alongX, alongY);
}

/**
 * Radius of each ring, given the items' angles: at least ringSpacing past the previous ring, clear of
 * its shapes, and wide enough that neighbours on the ring (wrap-around included) do not touch.
 */
function ringRadii(items: Item[], maxDepth: number, ringSpacing: number, boxes: boolean): number[] {
  const radii: number[] = [0];
  let prevMaxExt = 0;
  let prevMaxLabel = 0;
  for (let d = 1; d <= maxDepth; d++) {
    const ring = items.filter((i) => i.depth === d).sort((a, b) => a.theta - b.theta);
    const maxExt = Math.max(...ring.map((i) => i.ext));
    let r = Math.max(radii[d - 1] + ringSpacing, radii[d - 1] + (prevMaxExt + maxExt) / 2 + GAP);
    // Dot labels run outward from their dot: the previous ring's longest one must end before this ring.
    if (!boxes && prevMaxLabel > 0) r = Math.max(r, radii[d - 1] + DOT_LABEL_OFFSET + prevMaxLabel + LABEL_MARGIN);
    if (ring.length >= 2) {
      for (let k = 0; k < ring.length; k++) {
        const a = ring[k];
        const b = ring[(k + 1) % ring.length];
        const dTheta = (((b.theta - a.theta) % TWO_PI) + TWO_PI) % TWO_PI;
        r = Math.max(r, chordNeeded(a, b, a.theta + dTheta / 2, boxes) / (2 * Math.sin(dTheta / 2)));
      }
    }
    radii[d] = r;
    prevMaxExt = maxExt;
    prevMaxLabel = Math.max(...ring.map((i) => i.labelW));
  }
  return radii;
}

export const radial: NodeLayoutPlugin = {
  id: 'radial',
  name: 'Radial',
  optionsSchema: [
    { key: 'ringSpacing', label: 'Ring spacing', type: 'number', min: 30, max: 300, step: 5, default: 80 },
    {
      key: 'nodeStyle',
      label: 'Node style',
      type: 'select',
      choices: [
        { value: 'dots', label: 'Dots' },
        { value: 'boxes', label: 'Boxes' },
      ],
      default: 'dots',
    },
  ],
  run(tree: TeamTree, options, ctx): NodeLayoutResult {
    const ringSpacing = getNumber(options, 'ringSpacing');
    const boxes = getString(options, 'nodeStyle') === 'boxes';
    if (tree.roots.length === 0) {
      return { nodes: [], bounds: { x: 0, y: 0, w: 0, h: 0 }, direction: 'outward', hasEdges: true, origin: { x: 0, y: 0 } };
    }

    const toDatum = (t: TeamNode): Datum => ({ team: t, children: t.children.map(toDatum) });
    const root = hierarchy<Datum>({ children: tree.roots.map(toDatum) }, (d) => d.children);
    const itemOf = new Map<HierarchyNode<Datum>, Item>();
    root.each((h) => {
      if (!h.data.team) return;
      const team = h.data.team;
      const { w, h: bh } = boxFor(team.name, ctx);
      itemOf.set(h, {
        team,
        depth: h.depth,
        parentId: h.parent && h.parent.data.team ? h.parent.data.team.id : null,
        theta: 0,
        w,
        h: bh,
        ext: boxes ? Math.hypot(w, bh) : 2 * DOT_R,
        labelW: boxes ? 0 : ctx.measure(team.name, ctx.fontSize).width,
      });
    });
    const items = [...itemOf.values()];
    const maxDepth = Math.max(...items.map((i) => i.depth));

    const place = (separation: (a: HierarchyNode<Datum>, b: HierarchyNode<Datum>) => number): number[] => {
      d3tree<Datum>().size([TWO_PI, 1]).separation(separation)(root);
      itemOf.forEach((it, h) => { it.theta = h.x ?? 0; });
      return ringRadii(items, maxDepth, ringSpacing, boxes);
    };
    let radii = place((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);
    // Boxes: re-run d3 with the angle each pair of neighbours really needs at the last pass's angles
    // and radii, so wide boxes get more of the ring and boxes stacked at the sides get less.
    if (boxes) {
      for (let pass = 0; pass < BOX_REFINE_PASSES; pass++) {
        const prev = radii;
        radii = place((a, b) => {
          const ia = itemOf.get(a)!, ib = itemOf.get(b)!;
          const chord = chordNeeded(ia, ib, (ia.theta + ib.theta) / 2, true);
          return 2 * Math.asin(Math.min(1, chord / (2 * prev[a.depth])));
        });
      }
    }

    const nodes: PlacedNode[] = items.map((it) => {
      const R = radii[it.depth];
      const cos = Math.cos(it.theta);
      const sin = Math.sin(it.theta);
      const cx = R * cos;
      const cy = R * sin;
      const base = { id: it.team.id, name: it.team.name, depth: it.depth, parentId: it.parentId, hiddenDescendants: it.team.hiddenDescendants, stacked: false };
      if (boxes) {
        return { ...base, shape: { kind: 'rect', x: cx - it.w / 2, y: cy - it.h / 2, w: it.w, h: it.h }, label: { text: it.team.name, x: cx, y: cy, anchor: 'middle', rotate: 0 } };
      }
      return {
        ...base,
        shape: { kind: 'dot', cx, cy, r: DOT_R },
        label: { text: it.team.name, x: cx + DOT_LABEL_OFFSET * cos, y: cy + DOT_LABEL_OFFSET * sin, anchor: cos >= 0 ? 'start' : 'end', rotate: readableRotation((it.theta * 180) / Math.PI) },
      };
    });
    const bounds: Rect = unionRects(nodes.flatMap((n) => [shapeRect(n.shape), labelExtent(n, ctx)]));
    return { nodes, bounds, direction: 'outward', hasEdges: true, origin: { x: 0, y: 0 } };
  },
};
