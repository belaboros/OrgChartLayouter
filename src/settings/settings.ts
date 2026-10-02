import type { Options, OptionsSchema } from '../plugins/types';
import { resolveOptions } from '../plugins/options';
import { layouts, findPlugin } from '../layouts/registry';
import { anchors } from '../anchors/registry';
import { routers } from '../routers/registry';

export type Axis = 'layout' | 'anchor' | 'router';

export interface Settings {
  maxDepth: number | null;
  fontSize: number;
  lineWidth: number;
  layoutId: string;
  anchorId: string;
  routerId: string;
  /** Key is `${axis}/${id}`. */
  pluginOptions: Record<string, Options>;
}

export const STORAGE_KEY = 'orgchart-workbench/settings/v1';

const AXES: Axis[] = ['layout', 'anchor', 'router'];

function registryFor(axis: Axis): { id: string; optionsSchema: OptionsSchema }[] {
  return axis === 'layout' ? layouts : axis === 'anchor' ? anchors : routers;
}

export function defaultSettings(): Settings {
  return {
    maxDepth: null,
    fontSize: 14,
    lineWidth: 1.5,
    layoutId: 'top-down',
    anchorId: 'auto',
    routerId: 'orthogonal-elbow',
    pluginOptions: {},
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function pluginId(v: unknown, axis: Axis, fallback: string): string {
  return typeof v === 'string' && findPlugin(registryFor(axis), v) ? v : fallback;
}

export function loadSettings(storage: Pick<Storage, 'getItem'> | null): Settings {
  const d = defaultSettings();
  let raw: unknown;
  try {
    const text = storage?.getItem(STORAGE_KEY);
    if (!text) return d;
    raw = JSON.parse(text);
  } catch {
    return d;
  }
  if (!isRecord(raw)) return d;

  const pluginOptions: Record<string, Options> = {};
  if (isRecord(raw.pluginOptions)) {
    for (const [key, value] of Object.entries(raw.pluginOptions)) {
      const slash = key.indexOf('/');
      const axis = key.slice(0, slash) as Axis;
      if (slash < 0 || !AXES.includes(axis)) continue;
      const plugin = findPlugin(registryFor(axis), key.slice(slash + 1));
      if (!plugin) continue;
      pluginOptions[key] = resolveOptions(plugin.optionsSchema, isRecord(value) ? (value as Options) : {});
    }
  }

  const md = raw.maxDepth;
  return {
    maxDepth: typeof md === 'number' && Number.isInteger(md) && md >= 1 ? md : null,
    fontSize: num(raw.fontSize, d.fontSize, 8, 32),
    lineWidth: Math.round(num(raw.lineWidth, d.lineWidth, 0.5, 6) * 2) / 2,
    layoutId: pluginId(raw.layoutId, 'layout', d.layoutId),
    anchorId: pluginId(raw.anchorId, 'anchor', d.anchorId),
    routerId: pluginId(raw.routerId, 'router', d.routerId),
    pluginOptions,
  };
}

export function saveSettings(storage: Pick<Storage, 'setItem'> | null, s: Settings): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable or full: ignore */
  }
}

export function pluginOptionsFor(s: Settings, axis: Axis, id: string): Options {
  const plugin = findPlugin(registryFor(axis), id);
  if (!plugin) throw new Error('Unknown plugin');
  return resolveOptions(plugin.optionsSchema, s.pluginOptions[`${axis}/${id}`]);
}
