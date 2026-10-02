import { describe, it, expect } from 'vitest';
import { runPipeline, defaultRegistries, type Registries } from '../../src/pipeline/run';
import { PALETTE } from '../../src/render/palette';
import type { Settings } from '../../src/settings/settings';
import { fakeMeasure } from '../helpers/fake-measure';
import { loadTree } from '../helpers/trees';

const small = loadTree('src/samples/small.teams.yaml');
const S: Settings = {
  maxDepth: null, fontSize: 10, lineWidth: 1.5,
  layoutId: 'top-down', anchorId: 'auto', routerId: 'orthogonal-elbow', pluginOptions: {},
};

describe('runPipeline', () => {
  it('default run: one node per team and one edge per non-root team', () => {
    const r = runPipeline(small, S, fakeMeasure); if (!r.ok) throw r;
    expect(r.scene.nodes).toHaveLength(15);
    expect(r.scene.hasEdges).toBe(true);
    expect(r.scene.edges).toHaveLength(r.scene.nodes.filter((n) => n.parentId).length);
    const ids = new Set(r.scene.nodes.map((n) => n.id));
    for (const e of r.scene.edges) { expect(ids.has(e.fromId) && ids.has(e.toId)).toBe(true); expect(e.d).toMatch(/^M/); }
  });

  it('scene carries style from settings and the palette', () => {
    const r = runPipeline(small, { ...S, fontSize: 12, lineWidth: 3 }, fakeMeasure); if (!r.ok) throw r;
    expect(r.scene.style).toEqual({ fontSize: 12, lineWidth: 3, palette: PALETTE });
    expect(r.scene.bounds.w).toBeGreaterThan(0);
  });

  it('PALETTE has 8 distinct light fills', () => {
    expect(PALETTE).toHaveLength(8);
    expect(new Set(PALETTE).size).toBe(8);
    for (const c of PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('containment layouts produce no edges', () => {
    const r = runPipeline(small, { ...S, layoutId: 'nested-rects' }, fakeMeasure);
    expect(r.ok && r.scene.edges.length === 0 && !r.scene.hasEdges).toBe(true);
  });

  it('maxDepth 1 keeps only top-level teams with hidden counts', () => {
    const r = runPipeline(small, { ...S, maxDepth: 1 }, fakeMeasure); if (!r.ok) throw r;
    expect(r.scene.nodes.every((n) => n.depth === 1)).toBe(true);
    expect(r.scene.nodes.reduce((s, n) => s + n.hiddenDescendants + 1, 0)).toBe(15);
    expect(r.scene.edges).toHaveLength(0);
  });

  it('passes stored plugin options through', () => {
    const base = runPipeline(small, S, fakeMeasure); if (!base.ok) throw base;
    const r = runPipeline(small, { ...S, pluginOptions: { 'layout/top-down': { levelGap: 100 } } }, fakeMeasure);
    if (!r.ok) throw r;
    expect(r.scene.bounds.h).toBeGreaterThan(base.scene.bounds.h);
  });

  it('resolves options per plugin: a key for another plugin is ignored', () => {
    const base = runPipeline(small, S, fakeMeasure); if (!base.ok) throw base;
    const r = runPipeline(small, { ...S, pluginOptions: { 'layout/left-right': { levelGap: 100 } } }, fakeMeasure);
    expect(r).toEqual(base);
  });

  it.each(['layout', 'anchor', 'router'] as const)('a throwing %s plugin becomes an error result', (axis) => {
    const boom = { id: 'boom', name: 'Boom', optionsSchema: [], run: () => { throw new Error('kaput'); } };
    const regs = { ...defaultRegistries, [`${axis}s`]: [boom] };
    const r = runPipeline(small, { ...S, [`${axis}Id`]: 'boom' }, fakeMeasure, regs as unknown as Registries);
    expect(r).toEqual({ ok: false, axis, pluginId: 'boom', message: 'kaput' });
  });

  it('a non-Error throw is stringified', () => {
    const boom = { id: 'boom', name: 'Boom', optionsSchema: [], run: () => { throw 'plain'; } };
    const r = runPipeline(small, { ...S, layoutId: 'boom' }, fakeMeasure, { ...defaultRegistries, layouts: [boom] } as unknown as Registries);
    expect(r).toEqual({ ok: false, axis: 'layout', pluginId: 'boom', message: 'plain' });
  });

  it('anchor and router are not run for a layout without edges', () => {
    const boom = { id: 'boom', name: 'Boom', optionsSchema: [], run: () => { throw new Error('no'); } };
    const regs = { ...defaultRegistries, anchors: [boom], routers: [boom] } as unknown as Registries;
    const r = runPipeline(small, { ...S, layoutId: 'nested-rects', anchorId: 'boom', routerId: 'boom' }, fakeMeasure, regs);
    expect(r.ok).toBe(true);
  });

  it('unknown ids are checked in axis order, even without edges', () => {
    expect(runPipeline(small, { ...S, routerId: 'nope' }, fakeMeasure))
      .toEqual({ ok: false, axis: 'router', pluginId: 'nope', message: 'Unknown plugin' });
    expect(runPipeline(small, { ...S, anchorId: 'a?', routerId: 'nope' }, fakeMeasure))
      .toEqual({ ok: false, axis: 'anchor', pluginId: 'a?', message: 'Unknown plugin' });
    expect(runPipeline(small, { ...S, layoutId: 'l?', anchorId: 'a?', routerId: 'nope' }, fakeMeasure))
      .toEqual({ ok: false, axis: 'layout', pluginId: 'l?', message: 'Unknown plugin' });
    expect(runPipeline(small, { ...S, layoutId: 'nested-rects', routerId: 'nope' }, fakeMeasure))
      .toEqual({ ok: false, axis: 'router', pluginId: 'nope', message: 'Unknown plugin' });
  });
});
