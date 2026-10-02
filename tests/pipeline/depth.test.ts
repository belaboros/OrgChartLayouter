import { describe, it, expect } from 'vitest';
import { parseTeams } from '../../src/model/parse';
import { limitDepth } from '../../src/pipeline/depth';

const T = parseTeams('A:\n  B:\n    C:\n      D:\n  E:\nF:\n').tree;

describe('limitDepth', () => {
  it('null keeps everything', () => expect(limitDepth(T, null)).toEqual(T));

  it('limit 1 keeps top level and counts all hidden descendants', () => {
    const L = limitDepth(T, 1);
    expect(L.roots.map(r => [r.name, r.children.length, r.hiddenDescendants])).toEqual([
      ['A', 0, 4],
      ['F', 0, 0],
    ]);
  });

  it('limit 2 counts the whole hidden subtree, not just direct children', () => {
    const [B, E] = limitDepth(T, 2).roots[0].children;
    expect([B.hiddenDescendants, E.hiddenDescendants]).toEqual([2, 0]);
  });

  it('a limit deeper than the tree changes nothing', () => expect(limitDepth(T, 10)).toEqual(T));

  it('does not mutate the input', () => {
    const copy = structuredClone(T);
    limitDepth(T, 1);
    expect(T).toEqual(copy);
  });
});
