import { hierarchy, tree as d3tree } from 'd3-hierarchy';
import type { TeamNode, TeamTree } from '../model/types';
import type { NodeLayoutPlugin, NodeLayoutResult, PlacedNode, Rect } from '../plugins/types';
import { getNumber, getString } from '../plugins/options';
import { shapeRect, unionRects } from '../geometry/rect';
import { boxFor, fitLabel } from './label';

const DOT_R = 4;
const DOT_LABEL_OFFSET = 8;
const GAP = 4;
const TWO_PI = 2 * Math.PI;

interface Item { team: TeamNode; depth: number; parentId: string | null; theta: number; ext: number; w: number; h: number }
interface Datum { team?: TeamNode; children?: Datum[] }

/** Normalises a label rotation in degrees into (-90, 90]. */
function readableRotation(deg: number): number {
  const d = ((deg % 360) + 360) % 360;
  if (d > 270) return d - 360;
  if (d > 90) return d - 180;
  return d;
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
    d3tree<Datum>()
      .size([TWO_PI, 1])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth)(root);

    const items: Item[] = [];
    root.each((h) => {
      if (!h.data.team) return;
      const team = h.data.team;
      const { w, h: bh } = boxFor(team.name, ctx);
      items.push({
        team,
        depth: h.depth,
        parentId: h.parent && h.parent.data.team ? h.parent.data.team.id : null,
        theta: h.x ?? 0,
        w,
        h: bh,
        ext: boxes ? Math.hypot(w, bh) : 2 * DOT_R,
      });
    });

    const maxDepth = Math.max(...items.map((i) => i.depth));
    const radii: number[] = [0];
    let prevMaxExt = 0;
    for (let d = 1; d <= maxDepth; d++) {
      const ring = items.filter((i) => i.depth === d).sort((a, b) => a.theta - b.theta);
      const maxExt = Math.max(...ring.map((i) => i.ext));
      let r = Math.max(radii[d - 1] + ringSpacing, radii[d - 1] + (prevMaxExt + maxExt) / 2 + GAP);
      if (ring.length >= 2) {
        for (let k = 0; k < ring.length; k++) {
          const a = ring[k];
          const b = ring[(k + 1) % ring.length];
          const dTheta = (((b.theta - a.theta) % TWO_PI) + TWO_PI) % TWO_PI;
          const need = a.ext / 2 + b.ext / 2 + GAP;
          r = Math.max(r, need / (2 * Math.sin(dTheta / 2)));
        }
      }
      radii[d] = r;
      prevMaxExt = maxExt;
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
      const text = it.depth < maxDepth ? fitLabel(it.team.name, ringSpacing - 12, ctx) : it.team.name;
      return {
        ...base,
        shape: { kind: 'dot', cx, cy, r: DOT_R },
        label: { text, x: cx + DOT_LABEL_OFFSET * cos, y: cy + DOT_LABEL_OFFSET * sin, anchor: cos >= 0 ? 'start' : 'end', rotate: readableRotation((it.theta * 180) / Math.PI) },
      };
    });
    const bounds: Rect = unionRects(nodes.map((n) => shapeRect(n.shape)));
    return { nodes, bounds, direction: 'outward', hasEdges: true, origin: { x: 0, y: 0 } };
  },
};
