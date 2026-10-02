import { hierarchy, type HierarchyNode } from 'd3-hierarchy';
import type { TeamNode, TeamTree } from '../model/types';
import type { OptionSpec } from '../plugins/types';

/** Sizing-mode option shared by the containment layouts (nested rectangles, nested circles). */
export const SIZING_OPTION: OptionSpec = {
  key: 'sizing',
  label: 'Sizing',
  type: 'select',
  choices: [
    { value: 'fit', label: 'Fit to content' },
    { value: 'leaf-count', label: 'By leaf count' },
    { value: 'equal', label: 'Equal shares' },
  ],
  default: 'fit',
};

export interface Datum { team?: TeamNode; weight: number; children?: Datum[] }

/**
 * d3 hierarchy over an invisible root. `sum` is 1 per leaf (leaf-count) or the leaf's share of its
 * ancestors' equal split (equal); parents contribute 0.
 */
export function weightedHierarchy(tree: TeamTree, sizing: string): HierarchyNode<Datum> {
  const toDatum = (t: TeamNode, weight: number): Datum => ({
    team: t,
    weight,
    children: t.children.map((c) => toDatum(c, weight / t.children.length)),
  });
  const rootDatum: Datum = { weight: 1, children: tree.roots.map((t) => toDatum(t, 1 / tree.roots.length)) };
  const root = hierarchy<Datum>(rootDatum, (d) => (d.children && d.children.length ? d.children : undefined));
  return root.sum((d) => (d.children && d.children.length ? 0 : sizing === 'equal' ? d.weight : 1));
}
