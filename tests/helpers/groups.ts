import type { NodeLayoutResult, PlacedNode } from '../../src/plugins/types';

/** Parent/children groups of a layout result; children keep node order, top-level teams have no parent. */
export function groupsFor(result: NodeLayoutResult): { parent: PlacedNode; children: PlacedNode[] }[] {
  const byId = new Map(result.nodes.map((n) => [n.id, n]));
  const kids = new Map<string, PlacedNode[]>();
  for (const n of result.nodes) {
    if (n.parentId === null) continue;
    const list = kids.get(n.parentId) ?? [];
    list.push(n);
    kids.set(n.parentId, list);
  }
  return [...kids].map(([id, children]) => ({ parent: byId.get(id)!, children }));
}
