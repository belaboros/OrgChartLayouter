import { describe, it, expect } from 'vitest';
import { parseTeams } from '../../src/model/parse';

const names = (ns: { name: string }[]) => ns.map(n => n.name);

describe('parseTeams', () => {
  it('parses nested mappings; empty values are leaves', () => {
    const { tree, errors } = parseTeams('Engineering:\n  Platform:\n    Infra:\n    Tooling:\n  Product:\nSales:\n');
    expect(errors).toEqual([]);
    expect(names(tree.roots)).toEqual(['Engineering', 'Sales']);
    expect(names(tree.roots[0].children)).toEqual(['Platform', 'Product']);
    expect(names(tree.roots[0].children[0].children)).toEqual(['Infra', 'Tooling']);
    expect(tree.roots[0].children[1].children).toEqual([]);
  });
  it('treats null, ~ and {} as leaves', () => {
    const { tree } = parseTeams('A: null\nB: ~\nC: {}\n');
    expect(tree.roots.map(r => r.children.length)).toEqual([0, 0, 0]);
  });
  it('records 1-based lines and zero hiddenDescendants', () => {
    const infra = parseTeams('A:\n  B:\n    Infra:\n').tree.roots[0].children[0].children[0];
    expect(infra.line).toBe(3);
    expect(infra.hiddenDescendants).toBe(0);
  });
  it('uses paths as ids so equal names under different parents are distinct', () => {
    const { tree } = parseTeams('A:\n  Ops:\nB:\n  Ops:\n');
    expect(tree.roots.map(r => r.children[0].id)).toEqual(['A/Ops', 'B/Ops']);
  });
  it('encodes "/" inside names', () => {
    expect(parseTeams('"A/B":\n').tree.roots[0].id).toBe('A%2FB');
  });
  it('returns no roots and no errors for empty or comment-only text', () => {
    expect(parseTeams('')).toEqual({ tree: { roots: [] }, errors: [] });
    expect(parseTeams('# nothing\n')).toEqual({ tree: { roots: [] }, errors: [] });
  });
  it.each([
    ['scalar value', 'A:\n  B: foo\n', 2, /mapping/i],
    ['list', 'A:\n  - B\n', 2, /list/i],
    ['empty key', '"":\n', 1, /empty/i],
    ['whitespace key', '"  ":\n', 1, /empty/i],
    ['numeric key', 'A:\n  2024:\n', 2, /quote.*"2024"/i],
    ['boolean key', 'true:\n', 1, /quote.*"true"/i],
    ['duplicate key', 'A:\nA:\n', 2, /duplicate/i],
    ['top-level list', '- A\n', 1, /mapping/i],
  ])('%s → error on line %i', (_label, text, line, message) => {
    const { errors } = parseTeams(text as string);
    expect(errors[0].line).toBe(line);
    expect(errors[0].message).toMatch(message as RegExp);
  });
  it('reports YAML syntax errors with a line', () => {
    const { errors } = parseTeams('A:\n  B: [\n');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].line).toBeGreaterThanOrEqual(2);
  });
});
