import { describe, it, expect } from 'vitest';
import { parseTeams } from '../../src/model/parse';
import { treeDepth, countTeams } from '../../src/model/tree';

const T = parseTeams('A:\n  B:\n    C:\n      D:\n  E:\nF:\n').tree;

describe('tree helpers', () => {
  it('treeDepth / countTeams', () => {
    expect(treeDepth(T)).toBe(4);
    expect(countTeams(T)).toBe(6);
    expect(treeDepth({ roots: [] })).toBe(0);
  });
});
