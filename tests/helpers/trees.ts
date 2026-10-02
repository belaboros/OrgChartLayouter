import fs from 'node:fs';
import path from 'node:path';
import { parseTeams } from '../../src/model/parse';
import type { TeamTree } from '../../src/model/types';

const ROOT = path.resolve(__dirname, '../..');

export function loadTree(file: string): TeamTree {
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, file);
  const { tree, errors } = parseTeams(fs.readFileSync(abs, 'utf8'));
  if (errors.length > 0) throw new Error(`${file}: ${errors[0].message} (line ${errors[0].line})`);
  return tree;
}

export const CONTRACT_TREES: { name: string; tree: TeamTree }[] = [
  'src/samples/small.teams.yaml',
  'src/samples/medium.teams.yaml',
  'src/samples/large.teams.yaml',
  'tests/fixtures/long-names.teams.yaml',
  'tests/fixtures/single.teams.yaml',
  'tests/fixtures/chain40.teams.yaml',
  'tests/fixtures/flat150.teams.yaml',
].map((p) => ({ name: path.basename(p, '.teams.yaml'), tree: loadTree(p) }));
