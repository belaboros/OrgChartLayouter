import { LineCounter, isMap, isScalar, isSeq, parseDocument } from 'yaml';
import type { Node, YAMLMap } from 'yaml';
import type { ParseError, TeamNode, TeamTree } from './types';

// C0 controls that XML 1.0 forbids (tab, LF and CR are allowed); they would make the exported SVG invalid.
const XML_ILLEGAL_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

export function parseTeams(text: string): { tree: TeamTree; errors: ParseError[] } {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, uniqueKeys: true });
  const errors: ParseError[] = [];
  const lineAt = (offset: number) => lineCounter.linePos(offset).line;
  const nodeLine = (node: Node | null | undefined) => (node?.range ? lineAt(node.range[0]) : 1);

  for (const err of doc.errors) {
    // yaml reports duplicate keys at the end of the previous line; walk() reports them at the key itself.
    if (err.code === 'DUPLICATE_KEY') continue;
    errors.push({ message: err.message.split('\n')[0], line: lineAt(err.pos[0]) });
  }
  if (errors.length > 0) return { tree: { roots: [] }, errors };

  const root = doc.contents;
  if (root === null || (isScalar(root) && root.value === null)) {
    return { tree: { roots: [] }, errors };
  }
  if (!isMap(root)) {
    errors.push({ message: 'The file must be a mapping of team names', line: nodeLine(root) });
    return { tree: { roots: [] }, errors };
  }

  const walk = (map: YAMLMap, parentId: string): TeamNode[] => {
    const nodes: TeamNode[] = [];
    const seen = new Set<string>();
    for (const pair of map.items) {
      const key = pair.key as Node | null;
      const line = nodeLine(key);
      if (!isScalar(key)) {
        errors.push({ message: 'Team name must be plain text', line });
        continue;
      }
      if (typeof key.value !== 'string') {
        const src = key.source ?? String(key.value);
        errors.push({ message: `Team name ${src} must be quoted, e.g. "${src}":`, line });
        continue;
      }
      if (key.value.trim() === '') {
        errors.push({ message: 'Team name is empty', line });
        continue;
      }
      if (XML_ILLEGAL_CONTROL.test(key.value)) {
        errors.push({ message: 'Team name contains a control character', line });
        continue;
      }
      const name = key.value;
      if (seen.has(name)) {
        errors.push({ message: `Duplicate team name "${name}"`, line });
        continue;
      }
      seen.add(name);
      const id = (parentId ? parentId + '/' : '') + encodeURIComponent(name);
      const value = pair.value as Node | null;
      let children: TeamNode[] = [];
      if (isMap(value)) {
        children = walk(value, id);
      } else if (isSeq(value)) {
        errors.push({ message: 'Lists are not allowed; use nested "Name:" lines', line: nodeLine(value) });
      } else if (value !== null && !(isScalar(value) && value.value === null)) {
        errors.push({
          message: `Value of "${name}" must be a mapping of sub-teams or empty`,
          line: nodeLine(value),
        });
      }
      nodes.push({ id, name, children, line, hiddenDescendants: 0 });
    }
    return nodes;
  };

  const roots = walk(root, '');
  return { tree: { roots: errors.length > 0 ? [] : roots }, errors };
}
