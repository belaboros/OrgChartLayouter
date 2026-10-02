import { describe, it, expect } from 'vitest';
import { exportFilename } from '../../src/render/export-name';
import type { Settings } from '../../src/settings/settings';

const S: Settings = { maxDepth: null, fontSize: 14, lineWidth: 1.5, layoutId: 'top-down', anchorId: 'auto', routerId: 'orthogonal-elbow', pluginOptions: {} };

describe('exportFilename', () => {
  it('default name', () => expect(exportFilename(null, S)).toBe('orgchart.top-down-orthogonal-elbow-auto.svg'));
  it('strips .teams.yaml and adds depth', () =>
    expect(exportFilename('acme.teams.yaml', { ...S, layoutId: 'compact', routerId: 'orthogonal-bus', maxDepth: 3 }))
      .toBe('acme.compact-orthogonal-bus-auto-depth3.svg'));
  it('strips .teams.yaml case-insensitively', () =>
    expect(exportFilename('Acme.TEAMS.YAML', S)).toBe('Acme.top-down-orthogonal-elbow-auto.svg'));
  it('strips a plain .yaml or .yml only at the end', () => {
    expect(exportFilename('a.yaml', S)).toBe('a.top-down-orthogonal-elbow-auto.svg');
    expect(exportFilename('a.YML', S)).toBe('a.top-down-orthogonal-elbow-auto.svg');
    expect(exportFilename('a.yaml.txt', S)).toBe('a.yaml.txt.top-down-orthogonal-elbow-auto.svg');
  });
  it('keeps names without a yaml suffix', () =>
    expect(exportFilename('my.teams', S)).toBe('my.teams.top-down-orthogonal-elbow-auto.svg'));
  it('falls back to orgchart for an empty base', () => {
    expect(exportFilename('.teams.yaml', S)).toBe('orgchart.top-down-orthogonal-elbow-auto.svg');
    expect(exportFilename('.yml', S)).toBe('orgchart.top-down-orthogonal-elbow-auto.svg');
    expect(exportFilename('', S)).toBe('orgchart.top-down-orthogonal-elbow-auto.svg');
  });
});
