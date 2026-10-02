import { describe, it, expect } from 'vitest';
import { defaultSettings, loadSettings, saveSettings, pluginOptionsFor, STORAGE_KEY } from '../../src/settings/settings';

const store = (v: string | null) => ({ getItem: () => v });
const load = (o: unknown) => loadSettings(store(JSON.stringify(o)));

describe('settings', () => {
  it('defaults', () => {
    expect(defaultSettings()).toEqual({
      maxDepth: null, fontSize: 14, lineWidth: 1.5,
      layoutId: 'top-down', anchorId: 'auto', routerId: 'orthogonal-elbow', pluginOptions: {},
    });
  });
  it('null storage → defaults', () => expect(loadSettings(null)).toEqual(defaultSettings()));
  it('null item → defaults', () => expect(loadSettings(store(null))).toEqual(defaultSettings()));
  it('corrupt JSON → defaults', () => expect(loadSettings(store('{nope'))).toEqual(defaultSettings()));
  it('getItem throws → defaults', () =>
    expect(loadSettings({ getItem: () => { throw new Error('denied'); } })).toEqual(defaultSettings()));
  it('non-object JSON → defaults', () => {
    for (const v of ['[1]', '"x"', 'null', '5']) expect(loadSettings(store(v))).toEqual(defaultSettings());
  });
  it('reads the storage key', () => {
    let key = '';
    loadSettings({ getItem: (k) => { key = k; return null; } });
    expect(key).toBe(STORAGE_KEY);
    expect(STORAGE_KEY).toBe('orgchart-workbench/settings/v1');
  });
  it('unknown plugin id → default id, per axis', () => {
    const s = load({ layoutId: 'gone', anchorId: 'nope', routerId: 'x' });
    expect([s.layoutId, s.anchorId, s.routerId]).toEqual(['top-down', 'auto', 'orthogonal-elbow']);
  });
  it('keeps valid plugin ids on each axis', () => {
    const s = load({ layoutId: 'compact', anchorId: 'center', routerId: 'curved' });
    expect([s.layoutId, s.anchorId, s.routerId]).toEqual(['compact', 'center', 'curved']);
  });
  it('wrong-type id → default', () => expect(load({ layoutId: 5 }).layoutId).toBe('top-down'));
  it('clamps fontSize', () => {
    expect(load({ fontSize: 99 }).fontSize).toBe(32);
    expect(load({ fontSize: 1 }).fontSize).toBe(8);
    expect(load({ fontSize: 20 }).fontSize).toBe(20);
  });
  it('clamps and snaps lineWidth', () => {
    expect(load({ lineWidth: 99 }).lineWidth).toBe(6);
    expect(load({ lineWidth: 0 }).lineWidth).toBe(0.5);
    expect(load({ lineWidth: 2.3 }).lineWidth).toBe(2.5);
    expect(load({ lineWidth: 2.2 }).lineWidth).toBe(2);
  });
  it('wrong-type numbers → default', () => {
    expect(load({ fontSize: '20', lineWidth: null }).fontSize).toBe(14);
    expect(load({ fontSize: '20', lineWidth: null }).lineWidth).toBe(1.5);
  });
  it('maxDepth validation', () => {
    expect(load({ maxDepth: 0 }).maxDepth).toBeNull();
    expect(load({ maxDepth: -2 }).maxDepth).toBeNull();
    expect(load({ maxDepth: 2.5 }).maxDepth).toBeNull();
    expect(load({ maxDepth: '3' }).maxDepth).toBeNull();
    expect(load({ maxDepth: 1 }).maxDepth).toBe(1);
    expect(load({ maxDepth: 7 }).maxDepth).toBe(7);
    expect(load({ maxDepth: null }).maxDepth).toBeNull();
  });
  it('resolves stored plugin options', () => {
    const s = load({ pluginOptions: { 'layout/compact': { maxPerColumn: 999 } } });
    expect(s.pluginOptions['layout/compact'].maxPerColumn).toBe(50);
  });
  it('drops invalid pluginOptions keys', () => {
    const s = load({ pluginOptions: {
      'layout/gone': {}, 'bogus/compact': {}, 'compact': {}, 'anchor/compact': {}, 'layout/compact': { maxPerColumn: 5 },
    } });
    expect(Object.keys(s.pluginOptions)).toEqual(['layout/compact']);
  });
  it('non-object option value counts as {} (defaults)', () => {
    const s = load({ pluginOptions: { 'layout/compact': 'x' } });
    expect(s.pluginOptions['layout/compact'].maxPerColumn).toBe(8);
  });
  it('non-object pluginOptions → {}', () => {
    expect(load({ pluginOptions: [1] }).pluginOptions).toEqual({});
    expect(load({ pluginOptions: 'x' }).pluginOptions).toEqual({});
  });
  it('round-trips', () => {
    let saved = ''; let key = '';
    const s = { ...defaultSettings(), maxDepth: 3, routerId: 'curved', fontSize: 20, lineWidth: 2.5 };
    s.pluginOptions = { 'layout/compact': pluginOptionsFor({ ...s, pluginOptions: { 'layout/compact': { maxPerColumn: 5 } } }, 'layout', 'compact') };
    expect(s.pluginOptions['layout/compact'].maxPerColumn).toBe(5);
    saveSettings({ setItem: (k, v) => { key = k; saved = v; } }, s);
    expect(key).toBe(STORAGE_KEY);
    expect(loadSettings(store(saved))).toEqual(s);
  });
  it('saveSettings swallows storage errors and null storage', () => {
    expect(() => saveSettings({ setItem: () => { throw new Error('quota'); } }, defaultSettings())).not.toThrow();
    expect(() => saveSettings(null, defaultSettings())).not.toThrow();
  });
  it('pluginOptionsFor: stored, defaults, and unknown', () => {
    const s = { ...defaultSettings(), pluginOptions: { 'layout/compact': { maxPerColumn: 5 } } };
    expect(pluginOptionsFor(s, 'layout', 'compact').maxPerColumn).toBe(5);
    expect(pluginOptionsFor(defaultSettings(), 'layout', 'compact').maxPerColumn).toBe(8);
    expect(() => pluginOptionsFor(s, 'layout', 'gone')).toThrow('Unknown plugin');
    expect(() => pluginOptionsFor(s, 'router', 'compact')).toThrow('Unknown plugin');
  });
});
