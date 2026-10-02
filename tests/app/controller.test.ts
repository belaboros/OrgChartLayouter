import { describe, it, expect } from 'vitest';
import { computeView } from '../../src/app/controller';
import { defaultSettings } from '../../src/settings/settings';
import { defaultRegistries, type Registries } from '../../src/pipeline/run';
import { fakeMeasure } from '../helpers/fake-measure';

const ok = 'A:\n  B:\n';
const deep = 'A:\n  B:\n    C:\n';

describe('computeView', () => {
  it('valid text → fresh scene and depth', () => {
    const v = computeView(ok, defaultSettings(), fakeMeasure, null);
    expect([v.stale, v.empty, v.treeDepth, v.scene!.nodes.length]).toEqual([false, false, 2, 2]);
    expect(v.parseErrors).toEqual([]);
    expect(v.pluginError).toBeNull();
  });

  it('broken YAML keeps the last good scene, marked stale', () => {
    const good = computeView(deep, defaultSettings(), fakeMeasure, null);
    const bad = computeView('A:\n  B: [', defaultSettings(), fakeMeasure, good);
    expect(bad.scene).toBe(good.scene);
    expect(bad.stale).toBe(true);
    expect(bad.empty).toBe(false);
    expect(bad.treeDepth).toBe(3);
    expect(bad.pluginError).toBeNull();
    expect(bad.parseErrors.length).toBeGreaterThan(0);
  });

  it('broken YAML with no history → no scene, not stale', () => {
    const v = computeView('A: [', defaultSettings(), fakeMeasure, null);
    expect(v).toMatchObject({ scene: null, stale: false, treeDepth: 0, empty: false });
    expect(v.parseErrors.length).toBeGreaterThan(0);
  });

  it('empty text → empty state, even after a good view', () => {
    const good = computeView(ok, defaultSettings(), fakeMeasure, null);
    expect(computeView('', defaultSettings(), fakeMeasure, null))
      .toMatchObject({ empty: true, scene: null, stale: false, treeDepth: 0, parseErrors: [], pluginError: null });
    expect(computeView('', defaultSettings(), fakeMeasure, good))
      .toMatchObject({ empty: true, scene: null, stale: false, treeDepth: 0 });
  });

  it('recovers from an error: fresh scene, no stale flag', () => {
    const good = computeView(ok, defaultSettings(), fakeMeasure, null);
    const bad = computeView('A: [', defaultSettings(), fakeMeasure, good);
    const fixed = computeView(deep, defaultSettings(), fakeMeasure, bad);
    expect(fixed.stale).toBe(false);
    expect(fixed.parseErrors).toEqual([]);
    expect(fixed.scene).not.toBe(good.scene);
    expect(fixed.scene!.nodes).toHaveLength(3);
  });

  const boomRegs = { ...defaultRegistries, routers: [{ id: 'boom', name: 'Boom', optionsSchema: [], run: () => { throw new Error('kaput'); } }] } as unknown as Registries;
  const boomSettings = { ...defaultSettings(), routerId: 'boom' };

  it('plugin error keeps the last scene and reports it', () => {
    const good = computeView(ok, defaultSettings(), fakeMeasure, null);
    const v = computeView(deep, boomSettings, fakeMeasure, good, boomRegs);
    expect(v.scene).toBe(good.scene);
    expect(v.stale).toBe(true);
    expect(v.pluginError).toEqual({ axis: 'router', pluginId: 'boom', message: 'kaput' });
    expect(v.parseErrors).toEqual([]);
    expect(v.treeDepth).toBe(3);
  });

  it('plugin error with no history → no scene, not stale', () => {
    const v = computeView(ok, boomSettings, fakeMeasure, null, boomRegs);
    expect(v).toMatchObject({ scene: null, stale: false, treeDepth: 2, empty: false });
    expect(v.pluginError?.pluginId).toBe('boom');
  });

  it('treeDepth is the real depth, not the depth-limited one', () => {
    const v = computeView(deep, { ...defaultSettings(), maxDepth: 1 }, fakeMeasure, null);
    expect(v.treeDepth).toBe(3);
    expect(v.scene!.nodes).toHaveLength(1);
  });
});
