import type { ParseError } from '../model/types';
import type { Measure, Scene } from '../plugins/types';
import type { Axis, Settings } from '../settings/settings';
import { parseTeams } from '../model/parse';
import { treeDepth } from '../model/tree';
import { runPipeline, type Registries } from '../pipeline/run';

export interface View {
  scene: Scene | null;
  stale: boolean;
  empty: boolean;
  parseErrors: ParseError[];
  pluginError: { axis: Axis; pluginId: string; message: string } | null;
  treeDepth: number;
}

export function computeView(
  text: string,
  settings: Settings,
  measure: Measure,
  prev: View | null,
  registries?: Registries,
): View {
  const { tree, errors } = parseTeams(text);
  if (errors.length > 0) {
    const scene = prev?.scene ?? null;
    return { scene, stale: scene !== null, empty: false, parseErrors: errors, pluginError: null, treeDepth: prev?.treeDepth ?? 0 };
  }
  if (tree.roots.length === 0) {
    return { scene: null, stale: false, empty: true, parseErrors: [], pluginError: null, treeDepth: 0 };
  }
  const depth = treeDepth(tree);
  const result = runPipeline(tree, settings, measure, registries);
  if (!result.ok) {
    const scene = prev?.scene ?? null;
    const { axis, pluginId, message } = result;
    return { scene, stale: scene !== null, empty: false, parseErrors: [], pluginError: { axis, pluginId, message }, treeDepth: depth };
  }
  return { scene: result.scene, stale: false, empty: false, parseErrors: [], pluginError: null, treeDepth: depth };
}
