import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseTeams } from '../src/model/parse';
import { countTeams, treeDepth } from '../src/model/tree';
import type { TeamNode } from '../src/model/types';
import { loadTree } from './helpers/trees';

const samples: [string, number, number][] = [
  ['small', 15, 3],
  ['medium', 50, 4],
  ['large', 150, 5],
];

function names(nodes: TeamNode[], parent = ''): { name: string; parent: string }[] {
  return nodes.flatMap((n) => [{ name: n.name, parent }, ...names(n.children, n.id)]);
}

describe('samples', () => {
  for (const [name, teams, depth] of samples) {
    const tree = loadTree(`src/samples/${name}.teams.yaml`);
    it(`${name}: ${teams} teams over ${depth} levels`, () => {
      expect(countTeams(tree)).toBe(teams);
      expect(treeDepth(tree)).toBe(depth);
    });
    it(`${name}: has R&D and a name repeated under different parents`, () => {
      const all = names(tree.roots);
      expect(all.some((e) => e.name === 'R&D')).toBe(true);
      const parentsByName = new Map<string, Set<string>>();
      for (const e of all) parentsByName.set(e.name, (parentsByName.get(e.name) ?? new Set()).add(e.parent));
      expect([...parentsByName.values()].some((p) => p.size >= 2)).toBe(true);
    });
  }
});

describe('fixtures', () => {
  const dir = path.resolve(__dirname, 'fixtures');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.teams.yaml'));
  it('has the expected files', () => {
    expect(files.sort()).toEqual(['chain40', 'flat150', 'long-names', 'single'].map((n) => `${n}.teams.yaml`));
  });
  for (const f of files) {
    it(`${f} parses with no errors`, () => {
      expect(parseTeams(fs.readFileSync(path.join(dir, f), 'utf8')).errors).toEqual([]);
    });
  }
  it('shapes', () => {
    const t = (n: string) => loadTree(`tests/fixtures/${n}.teams.yaml`);
    expect([countTeams(t('long-names')), countTeams(t('single')), treeDepth(t('chain40')), countTeams(t('chain40'))]).toEqual([12, 1, 40, 40]);
    expect([t('flat150').roots.length, t('flat150').roots[0].children.length]).toEqual([1, 150]);
    expect(names(t('long-names').roots).filter((e) => e.name.length >= 80).length).toBeGreaterThanOrEqual(3);
  });
});
