import type { TeamTree } from '../model/types';
import type {
  AnchorPlugin, EdgeGroup, Measure, NodeLayoutPlugin, Plugin, RoutedPath, RouterPlugin, Scene,
} from '../plugins/types';
import type { Axis, Settings } from '../settings/settings';
import { resolveOptions } from '../plugins/options';
import { layouts, findPlugin } from '../layouts/registry';
import { anchors } from '../anchors/registry';
import { routers } from '../routers/registry';
import { PALETTE } from '../render/palette';
import { limitDepth } from './depth';
import { groupsFor } from './groups';

export interface Registries { layouts: NodeLayoutPlugin[]; anchors: AnchorPlugin[]; routers: RouterPlugin[] }
export const defaultRegistries: Registries = { layouts, anchors, routers };

export type PipelineResult =
  | { ok: true; scene: Scene }
  | { ok: false; axis: Axis; pluginId: string; message: string };

class PluginFailure {
  constructor(readonly axis: Axis, readonly pluginId: string, readonly message: string) {}
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function runPipeline(
  tree: TeamTree,
  settings: Settings,
  measure: Measure,
  registries: Registries = defaultRegistries,
): PipelineResult {
  const layout = findPlugin(registries.layouts, settings.layoutId);
  if (!layout) return { ok: false, axis: 'layout', pluginId: settings.layoutId, message: 'Unknown plugin' };
  const anchor = findPlugin(registries.anchors, settings.anchorId);
  if (!anchor) return { ok: false, axis: 'anchor', pluginId: settings.anchorId, message: 'Unknown plugin' };
  const router = findPlugin(registries.routers, settings.routerId);
  if (!router) return { ok: false, axis: 'router', pluginId: settings.routerId, message: 'Unknown plugin' };

  const ctx = { measure, fontSize: settings.fontSize };
  const call = <In, Out>(axis: Axis, plugin: Plugin<In, Out>, input: In): Out => {
    try {
      return plugin.run(input, resolveOptions(plugin.optionsSchema, settings.pluginOptions[`${axis}/${plugin.id}`]), ctx);
    } catch (e) {
      throw new PluginFailure(axis, plugin.id, errorMessage(e));
    }
  };

  try {
    const result = call('layout', layout, limitDepth(tree, settings.maxDepth));
    const edges: RoutedPath[] = [];
    if (result.hasEdges) {
      for (const { parent, children } of groupsFor(result)) {
        const group: EdgeGroup = call('anchor', anchor, { parent, children, direction: result.direction });
        edges.push(...call('router', router, { group, direction: result.direction, origin: result.origin }));
      }
    }
    return {
      ok: true,
      scene: {
        nodes: result.nodes,
        edges,
        bounds: result.bounds,
        hasEdges: result.hasEdges,
        style: { fontSize: settings.fontSize, lineWidth: settings.lineWidth, palette: PALETTE },
      },
    };
  } catch (e) {
    if (e instanceof PluginFailure) return { ok: false, axis: e.axis, pluginId: e.pluginId, message: e.message };
    throw e;
  }
}
