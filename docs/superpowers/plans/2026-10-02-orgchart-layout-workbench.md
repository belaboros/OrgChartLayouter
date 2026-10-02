# OrgChart Layout Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side web app that loads/edits `*.teams.yaml` team hierarchies and renders them with any combination of pluggable node layouts, anchor rules and edge routers, plus a global depth limit and SVG export.

**Architecture:** Pure TypeScript core (`model` → `pipeline` [depth limit → node layout → anchors → router] → `render`) with plugin registries per axis. A thin Svelte 5 UI drives it: CodeMirror editor, d3-zoom chart, settings sidebar generated from plugin option schemas. Every plugin is covered automatically by registry-driven contract tests.

**Tech Stack:** TypeScript (strict), Vite, Svelte 5, CodeMirror 6, `yaml`, d3-hierarchy, d3-flextree, d3-zoom, Vitest (+ jsdom), Playwright. npm.

**Spec:** `docs/superpowers/specs/2026-10-02-orgchart-layout-workbench-design.md`

## Global Constraints

- Fully client-side: no server code, and no network requests at runtime. `vite build` output is static and served with `base: './'`.
- Input files: `*.teams.yaml`, nested mappings of team names only.
- Levels are counted from the top: top-level teams have `depth: 1`. The invisible root is never drawn and is never a `PlacedNode`.
- Max depth defaults to `null`, meaning All.
- Redraw debounce is **200 ms** after the last keystroke.
- Compact layout: max teams per column defaults to **8**.
- Target aspect ratios: `16:9`, `4:3`, `1:1`, `A4` (portrait, 1:√2).
- Settings live in `localStorage` under key `orgchart-workbench/settings/v1`. Every access is wrapped in try/catch. Settings are never written into YAML.
- Export filename: `<file-name>.<layout>-<router>-<anchor>[-depth<N>].svg`. `<file-name>` is the opened file name minus `.teams.yaml`, or `orgchart` if there is none.
- Adding a plugin = one file plus one line in that axis's `registry.ts`. The UI and contract tests read only the registries.
- Routers emit absolute SVG path commands only: `M L Q C A`.
- Default selection: layout `top-down`, anchor `auto`, router `orthogonal-elbow`. Defaults: font size **14** (8–32), line width **1.5** (0.5–6, step 0.5).
- Geometry tolerance in tests: `EPS = 0.5` px for overlap and containment, `0.01` for anchor and endpoint equality.
- Performance target: a full pipeline run for 150 teams in < 50 ms. It is reported by the benchmark and never gates CI.

## Review Focus

1. **Long team names (80+ characters):** tree boxes grow without overlapping. Containment and radial labels are cut short with "…", and the full name stays in the tooltip. Pinned by the `long-names` fixture in Task 4's contract trees and a `fitLabel` test in Task 3.
2. **Unquoted numeric or boolean keys (`2024:`, `true:`):** a clear error on the right line that tells the user to quote the name, not a crash or a silent rename. Pinned in Task 1.
3. **Names with markup characters (`R&D`, `<Ops>`):** must render and export as text, with no broken SVG. Pinned in Task 14.
4. **Degenerate shapes:** a single team, a 40-level chain, or one parent with 150 direct children must lay out without NaN, overlap or a stack overflow. Pinned by the `single`, `chain40` and `flat150` fixtures in Task 4.
5. **Stale or corrupt stored settings** (a removed plugin id, out-of-range option, broken JSON, storage that throws) must fall back to defaults or clamp, and never stop the app from starting. Pinned in Task 15.

---

## File Structure

```
package.json, vite.config.ts, tsconfig.json, svelte.config.js, index.html, playwright.config.ts, .gitignore
src/
  main.ts                      mount App
  App.svelte                   page layout
  types/d3-flextree.d.ts       module declaration
  model/types.ts               TeamNode, TeamTree, ParseError
  model/parse.ts               parseTeams
  model/tree.ts                treeDepth, countTeams
  plugins/types.ts             all shared plugin/scene types
  plugins/options.ts           resolveOptions, getNumber/getString/getBoolean
  geometry/rect.ts             shapeRect, unionRects, shapeCenter
  layouts/label.ts             boxFor, fitLabel, BOX_PAD_X/Y
  layouts/registry.ts          layouts[]
  layouts/{top-down,left-right,compact,radial,nested-rects,nested-circles}.ts
  anchors/geometry.ts          sidePoint, boundaryPoint
  anchors/registry.ts, anchors/{auto,center,fixed-sides,nearest-sides,boundary}.ts
  routers/path.ts              polylinePath, routeOrientation
  routers/registry.ts, routers/{straight,orthogonal-elbow,orthogonal-bus,curved,radial-arc}.ts
  pipeline/depth.ts            limitDepth
  pipeline/run.ts              runPipeline, defaultRegistries
  render/palette.ts            PALETTE
  render/svg.ts                renderSceneMarkup, renderSvgDocument
  render/export-name.ts        exportFilename
  settings/settings.ts         Settings, defaultSettings, loadSettings, saveSettings
  app/controller.ts            View, computeView
  measure/canvas.ts            createCanvasMeasure
  ui/app-state.svelte.ts       reactive store (debounce, files, settings)
  ui/fit.ts                    fitTransform
  ui/files.ts                  openTeamsFile, saveTeamsFile, downloadText
  ui/{Toolbar,Editor,Chart,Sidebar,PluginSection,OptionsForm,MessageBar}.svelte
  samples/{small,medium,large}.teams.yaml
tests/
  helpers/{fake-measure,geometry,trees,variants,svg-path}.ts
  fixtures/{long-names,single,chain40,flat150}.teams.yaml
  model/, pipeline/, plugins/, layouts/, anchors/, routers/, render/, settings/, app/, ui/  unit tests
  contract/{layouts,anchors,routers}.contract.test.ts
bench/pipeline.bench.ts
e2e/smoke.spec.ts
```

---

### Task 1: Project scaffold and YAML model

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `svelte.config.js`, `index.html`, `.gitignore`, `src/main.ts`, `src/App.svelte` (placeholder `<main>OrgChart Layout Workbench</main>`), `src/types/d3-flextree.d.ts`
- Create: `src/model/types.ts`, `src/model/parse.ts`
- Test: `tests/model/parse.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface TeamNode { id: string; name: string; children: TeamNode[]; line: number /* 1-based */; hiddenDescendants: number }
  interface TeamTree { roots: TeamNode[] }
  interface ParseError { message: string; line: number /* 1-based */ }
  function parseTeams(text: string): { tree: TeamTree; errors: ParseError[] }
  ```
  `id` is the path of names from the top, with each name passed through `encodeURIComponent` and the parts joined by `/`. The parser always sets `hiddenDescendants: 0`. When `errors` is non-empty, callers must ignore `tree`.

- [ ] **Step 1: Scaffold the project**

  Install the dependencies:
  - Dev: `npm i -D vite svelte @sveltejs/vite-plugin-svelte typescript svelte-check vitest jsdom @playwright/test @types/d3-hierarchy @types/d3-zoom @types/d3-selection`
  - Runtime: `npm i yaml d3-hierarchy d3-flextree d3-zoom d3-selection codemirror @codemirror/lang-yaml @codemirror/lint @codemirror/state @codemirror/view`

  Scripts:
  - `dev`: `vite`
  - `build`: `svelte-check && vite build`
  - `preview`: `vite preview --port 4173`
  - `test`: `vitest run`
  - `bench`: `vitest bench --run`
  - `e2e`: `playwright test`

  Configuration:
  - `vite.config.ts`: `base: './'`, the svelte plugin, and `test: { include: ['tests/**/*.test.ts'] }`.
  - `tsconfig.json`: `strict: true`.
  - `.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`.

- [ ] **Step 2: Write the failing tests**

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

  Run: `npx vitest run tests/model/parse.test.ts`
  Expected: FAIL, because `parseTeams` can't be resolved.

- [ ] **Step 4: Implement `parseTeams` in `src/model/parse.ts`**

  How it works:
  - Parse with `parseDocument(text, { lineCounter, uniqueKeys: true })` from `yaml`.
  - Map YAML errors to `ParseError` using `lineCounter.linePos(err.pos[0]).line`.
  - Walk the document's AST nodes (`isMap`, `isSeq`, `isScalar`) so each item keeps its `range` for line numbers.

  Values:
  - A `null` value or an empty map is a leaf.
  - A map recurses.
  - A seq gives the error `Lists are not allowed; use nested "Name:" lines`.
  - Any other scalar gives `Value of "<key>" must be a mapping of sub-teams or empty`.

  Keys:
  - A non-string scalar key gives `Team name <src> must be quoted, e.g. "<src>":`, where `<src>` is the key's source text.
  - A key that is empty or only whitespace gives `Team name is empty`.

  Report each error at the line of the offending key or value.

- [ ] **Step 5: Run the tests to verify they pass**

  Run: `npx vitest run tests/model/parse.test.ts`
  Expected: PASS (15 tests).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold project and parse .teams.yaml"
```

---

### Task 2: Tree helpers and depth limit

**Files:**
- Create: `src/model/tree.ts`, `src/pipeline/depth.ts`
- Test: `tests/model/tree.test.ts`, `tests/pipeline/depth.test.ts`

**Interfaces:**
- Consumes: `TeamTree`, `TeamNode` (Task 1).
- Produces:
  ```ts
  function treeDepth(tree: TeamTree): number      // 0 for empty, 1 for only top-level teams
  function countTeams(tree: TeamTree): number
  function limitDepth(tree: TeamTree, maxDepth: number | null): TeamTree   // never mutates input
  ```

- [ ] **Step 1: Write the failing tests.** These use the fixture `T = parseTeams('A:\n  B:\n    C:\n      D:\n  E:\nF:\n').tree`.

```ts
it('treeDepth / countTeams', () => {
  expect(treeDepth(T)).toBe(4); expect(countTeams(T)).toBe(6);
  expect(treeDepth({ roots: [] })).toBe(0);
});
it('null keeps everything', () => expect(limitDepth(T, null)).toEqual(T));
it('limit 1 keeps top level and counts all hidden descendants', () => {
  const L = limitDepth(T, 1);
  expect(L.roots.map(r => [r.name, r.children.length, r.hiddenDescendants])).toEqual([['A', 0, 4], ['F', 0, 0]]);
});
it('limit 2 counts the whole hidden subtree, not just direct children', () => {
  const [B, E] = limitDepth(T, 2).roots[0].children;
  expect([B.hiddenDescendants, E.hiddenDescendants]).toEqual([2, 0]);
});
it('a limit deeper than the tree changes nothing', () => expect(limitDepth(T, 10)).toEqual(T));
it('does not mutate the input', () => { const copy = structuredClone(T); limitDepth(T, 1); expect(T).toEqual(copy); });
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run tests/model/tree.test.ts tests/pipeline/depth.test.ts`. Expected: FAIL (imports can't be resolved).
- [ ] **Step 3: Implement** `treeDepth` and `countTeams` in `src/model/tree.ts`, and `limitDepth` in `src/pipeline/depth.ts`. `limitDepth` makes a recursive copy. When `maxDepth === null`, it returns a deep copy.
- [ ] **Step 4: Run the tests to verify they pass.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -am "feat: tree depth helpers and depth limit"` (add the new files first).

---

### Task 3: Plugin types, options, geometry and label helpers

**Files:**
- Create: `src/plugins/types.ts`, `src/plugins/options.ts`, `src/geometry/rect.ts`, `src/layouts/label.ts`, `tests/helpers/fake-measure.ts`
- Test: `tests/plugins/options.test.ts`, `tests/layouts/label.test.ts`, `tests/geometry/rect.test.ts`

**Interfaces:**
- Produces (in `src/plugins/types.ts`). Every later task uses these names exactly:
  ```ts
  interface Point { x: number; y: number }
  interface Rect { x: number; y: number; w: number; h: number }
  type Shape = ({ kind: 'rect' } & Rect) | { kind: 'circle' | 'dot'; cx: number; cy: number; r: number };
  interface LabelPlacement { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; rotate: number }
  type Direction = 'down' | 'right' | 'outward' | 'none';
  interface PlacedNode { id: string; name: string; depth: number; parentId: string | null; hiddenDescendants: number;
                         stacked: boolean; shape: Shape; label: LabelPlacement }
  interface NodeLayoutResult { nodes: PlacedNode[]; bounds: Rect; direction: Direction; hasEdges: boolean; origin: Point | null }
  type Side = 'top' | 'bottom' | 'left' | 'right';
  interface AnchorPoint extends Point { side: Side | 'center' | 'boundary' }
  interface Edge { child: PlacedNode; from: AnchorPoint; to: AnchorPoint }
  interface EdgeGroup { parent: PlacedNode; edges: Edge[] }
  interface RoutedPath { fromId: string; toId: string; d: string }
  interface Scene { nodes: PlacedNode[]; edges: RoutedPath[]; bounds: Rect; hasEdges: boolean;
                    style: { fontSize: number; lineWidth: number; palette: readonly string[] } }
  type OptionSpec =
    | { key: string; label: string; type: 'number'; min: number; max: number; step: number; default: number }
    | { key: string; label: string; type: 'select'; choices: { value: string; label: string }[]; default: string }
    | { key: string; label: string; type: 'boolean'; default: boolean };
  type OptionsSchema = readonly OptionSpec[];
  type Options = Record<string, unknown>;
  type Measure = (text: string, fontSize: number) => { width: number; height: number };
  interface Ctx { measure: Measure; fontSize: number }
  interface Plugin<In, Out> { id: string; name: string; optionsSchema: OptionsSchema; run(input: In, options: Options, ctx: Ctx): Out }
  interface AnchorInput { parent: PlacedNode; children: PlacedNode[]; direction: Direction }
  interface RouterInput { group: EdgeGroup; direction: Direction; origin: Point | null }
  type NodeLayoutPlugin = Plugin<TeamTree, NodeLayoutResult>;
  type AnchorPlugin = Plugin<AnchorInput, EdgeGroup>;
  type RouterPlugin = Plugin<RouterInput, RoutedPath[]>;
  ```
- `src/plugins/options.ts`:
  - `resolveOptions(schema: OptionsSchema, stored?: Options): Options` fills in defaults, clamps numbers to `[min, max]`, and replaces wrong types or unknown select values with the default. Unknown keys are dropped.
  - `getNumber(o: Options, key: string): number`, `getString(...)` and `getBoolean(...)` throw if the key is missing or has the wrong type.
- `src/geometry/rect.ts`: `shapeRect(s: Shape): Rect`, `shapeCenter(s: Shape): Point`, `unionRects(rs: Rect[]): Rect` (`{0,0,0,0}` for an empty list).
- `src/layouts/label.ts`:
  - `BOX_PAD_X = 8`, `BOX_PAD_Y = 4`
  - `boxFor(name: string, ctx: Ctx): { w: number; h: number }` returns the measured label size plus 2× padding.
  - `fitLabel(text: string, maxWidth: number, ctx: Ctx): string` returns the longest prefix plus "…" that fits, or `''` if even "…" doesn't fit.
- `tests/helpers/fake-measure.ts`: `fakeMeasure: Measure = (t, fs) => ({ width: t.length * fs * 0.6, height: fs * 1.2 })` and `fakeCtx: Ctx = { measure: fakeMeasure, fontSize: 10 }`.

- [ ] **Step 1: Write the failing tests**

```ts
// options.test.ts
const schema: OptionsSchema = [
  { key: 'gap', label: 'Gap', type: 'number', min: 0, max: 80, step: 1, default: 16 },
  { key: 'mode', label: 'Mode', type: 'select', choices: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], default: 'a' },
  { key: 'on', label: 'On', type: 'boolean', default: true },
];
it('fills defaults', () => expect(resolveOptions(schema)).toEqual({ gap: 16, mode: 'a', on: true }));
it('clamps numbers and rejects bad values', () =>
  expect(resolveOptions(schema, { gap: 500, mode: 'zzz', on: 'yes', extra: 1 })).toEqual({ gap: 80, mode: 'a', on: true }));
it('keeps valid stored values', () =>
  expect(resolveOptions(schema, { gap: 3, mode: 'b', on: false })).toEqual({ gap: 3, mode: 'b', on: false }));
it('getNumber throws on missing key', () => expect(() => getNumber({}, 'gap')).toThrow());

// label.test.ts  (fakeCtx: 6 px per char)
it('boxFor adds padding', () => expect(boxFor('abcd', fakeCtx)).toEqual({ w: 24 + 16, h: 12 + 8 }));
it('fitLabel keeps text that fits', () => expect(fitLabel('abcd', 24, fakeCtx)).toBe('abcd'));
it('fitLabel truncates with an ellipsis', () => expect(fitLabel('abcdefgh', 30, fakeCtx)).toBe('abcd…'));
it('fitLabel handles an 80-char name in a tiny box', () => expect(fitLabel('x'.repeat(80), 3, fakeCtx)).toBe(''));

// rect.test.ts
it('shapeRect of a circle', () => expect(shapeRect({ kind: 'circle', cx: 10, cy: 10, r: 5 })).toEqual({ x: 5, y: 5, w: 10, h: 10 }));
it('unionRects', () => expect(unionRects([{ x: 0, y: 0, w: 1, h: 1 }, { x: 5, y: -2, w: 1, h: 1 }])).toEqual({ x: 0, y: -2, w: 6, h: 3 }));
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run tests/plugins tests/layouts/label.test.ts tests/geometry`. Expected: FAIL (imports can't be resolved).
- [ ] **Step 3: Implement** the types and the three helper modules as specified in the Interfaces block above.
- [ ] **Step 4: Run the tests to verify they pass.** Expected: PASS.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat: plugin types, options resolution, geometry and label helpers"`

---

### Task 4: Top-down layout, layout registry and layout contract tests

**Files:**
- Create: `src/layouts/top-down.ts`, `src/layouts/registry.ts`
- Create: `src/samples/small.teams.yaml` (15 teams, 3 levels), `src/samples/medium.teams.yaml` (50 teams, 4 levels), `src/samples/large.teams.yaml` (150 teams, 5 levels). Use realistic department names, and include at least one `R&D` and one name that repeats under different parents.
- Create: `tests/fixtures/long-names.teams.yaml` (12 teams, several names of 80+ chars), `single.teams.yaml` (1 team), `chain40.teams.yaml` (a 40-level chain), `flat150.teams.yaml` (1 parent with 150 leaf children)
- Create: `tests/helpers/trees.ts`, `tests/helpers/geometry.ts`, `tests/helpers/variants.ts`
- Test: `tests/layouts/top-down.test.ts`, `tests/contract/layouts.contract.test.ts`, `tests/samples.test.ts`

**Interfaces:**
- Consumes: Task 1–3 types, `limitDepth`, `countTeams`, `boxFor`, `fitLabel`, `resolveOptions`.
- Produces:
  - `layouts: NodeLayoutPlugin[]` in `src/layouts/registry.ts`, and `findPlugin<P extends { id: string }>(list: P[], id: string): P | undefined` in the same file. The anchor and router registries reuse `findPlugin`.
  - `topDown: NodeLayoutPlugin`, id `'top-down'`. Options:
    - `siblingGap`: number, 0–80, step 1, default 16
    - `levelGap`: number, 10–150, step 1, default 40
  - Test helpers:
    - `loadTree(path: string): TeamTree` reads the file with `fs` and runs `parseTeams`.
    - `CONTRACT_TREES: { name: string; tree: TeamTree }[]` covers the 3 samples and 4 fixtures.
    - `optionVariants(schema): Options[]` returns the defaults, plus for each number its min and its max, for each select every choice, and for each boolean the flipped value. Each variant changes one key; all others stay at the default.
    - `overlaps(a: Shape, b: Shape, eps = 0.5): boolean` handles rect/rect and circle/circle and throws on mixed kinds.
    - `contains(outer: Shape, inner: Shape, eps = 0.5): boolean`.

  Every layout in this and later tasks must build `PlacedNode` from `TeamNode` this way:
  - `depth`: 1-based.
  - `parentId`: `null` for top-level teams.
  - `hiddenDescendants`: copied from the `TeamNode`.
  - `stacked`: `false` unless the compact layout stacks the node.
  - `bounds`: equal to `unionRects` of all shapes.

- [ ] **Step 1: Write the failing contract test.** It iterates `layouts × CONTRACT_TREES × optionVariants × maxDepth ∈ [null, 1, 3]`, runs `layout.run(limitDepth(tree, d), options, fakeCtx)`, and asserts:

```ts
const result = layout.run(limited, options, fakeCtx);
expect(result.nodes).toHaveLength(countTeams(limited));
expect(new Set(result.nodes.map(n => n.id)).size).toBe(result.nodes.length);
for (const n of result.nodes) {
  const src = byId.get(n.id)!;                      // map of limited tree nodes, with depth and parent id
  expect([n.depth, n.parentId, n.hiddenDescendants]).toEqual([src.depth, src.parentId, src.node.hiddenDescendants]);
  expect(Object.values(n.shape).filter(v => typeof v === 'number').every(Number.isFinite)).toBe(true);
  expect(contains({ kind: 'rect', ...result.bounds }, n.shape)).toBe(true);
}
if (result.hasEdges) {
  for (each pair a,b) expect(overlaps(a.shape, b.shape)).toBe(false);
} else {
  for (each node with parent p) expect(contains(p.shape, n.shape)).toBe(true);
  for (each pair of siblings a,b) expect(overlaps(a.shape, b.shape)).toBe(false);
}
```

  Also write `tests/samples.test.ts`:
  - `countTeams` is 15, 50 and 150 for the three samples.
  - `treeDepth` is 3, 4 and 5.
  - every fixture parses with no errors.

- [ ] **Step 2: Write the failing top-down tests**

```ts
const tree = parseTeams('A:\n  B:\n  C:\n  D:\nE:\n').tree;
const r = topDown.run(tree, resolveOptions(topDown.optionsSchema), fakeCtx);
const at = (name: string) => r.nodes.find(n => n.name === name)!.shape as Rect & { kind: 'rect' };
it('direction down, has edges, no origin', () => expect([r.direction, r.hasEdges, r.origin]).toEqual(['down', true, null]));
it('children are one level gap below the parent', () => expect(at('B').y).toBeGreaterThanOrEqual(at('A').y + at('A').h + 40 - 0.01));
it('siblings keep YAML order left to right', () => expect(at('B').x < at('C').x && at('C').x < at('D').x).toBe(true));
it('parent centred over its children', () => expect(at('A').x + at('A').w / 2).toBeCloseTo(at('C').x + at('C').w / 2, 1));
it('top-level teams share one row', () => expect(at('A').y).toBeCloseTo(at('E').y));
it('rect size comes from boxFor', () => expect([at('B').w, at('B').h]).toEqual([boxFor('B', fakeCtx).w, boxFor('B', fakeCtx).h]));
```

- [ ] **Step 3: Run the tests to verify they fail.** Run `npx vitest run tests/layouts tests/contract tests/samples.test.ts`. Expected: FAIL.

- [ ] **Step 4: Implement `topDown`.** Use d3-flextree over an invisible root with `nodeSize: [0, 0]`. Real nodes get `nodeSize: [w + siblingGap, h + levelGap]`, and `spacing` is 0. Flextree gives each node `x` (centre) and `y` (top), so the shape rect is `x - w/2, y, w, h`. Drop the invisible root. The label is `{ text: name, x: cx, y: cy, anchor: 'middle', rotate: 0 }`. Register the plugin in `layouts`. Write the sample and fixture files.

- [ ] **Step 5: Run the tests to verify they pass.** Run `npx vitest run`. Expected: PASS.

- [ ] **Step 6: Commit:** `git add -A && git commit -m "feat: top-down layout, samples, layout contract tests"`

---

### Task 5: Left-to-right layout

**Files:**
- Create: `src/layouts/left-right.ts`
- Modify: `src/layouts/registry.ts` (add one line)
- Test: `tests/layouts/left-right.test.ts`

**Interfaces:**
- Produces: `leftRight: NodeLayoutPlugin`, id `'left-right'`. Same options as `topDown`. `direction: 'right'`.

- [ ] **Step 1: Write the failing tests.** They mirror the top-down tests with the axes swapped:
  - `at('B').x >= at('A').x + at('A').w + 40`
  - siblings B, C, D in increasing `y`
  - A's centre y equals C's centre y (within 1 decimal)
  - top-level teams share the same `x`
- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run tests/layouts/left-right.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Use flextree with `nodeSize: [h + siblingGap, w + levelGap]`, then map the flextree `x` to the screen `y` (centre) and the flextree `y` to the screen `x` (left edge).
- [ ] **Step 4: Run all tests.** Run `npx vitest run`. Expected: PASS. The contract tests now cover `left-right`.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat: left-to-right layout"`

---

### Task 6: Compact layout

**Files:**
- Create: `src/layouts/compact.ts`
- Modify: `src/layouts/registry.ts`
- Test: `tests/layouts/compact.test.ts`

**Interfaces:**
- Produces: `compact: NodeLayoutPlugin`, id `'compact'`, `direction: 'down'`. Options:
  - `siblingGap` and `levelGap`, as in top-down
  - `maxPerColumn`: number, 1–50, step 1, default 8

  Nodes placed in a leaf column get `stacked: true`.

**Algorithm.** A recursive bottom-up block layout. Each subtree returns a block with its width, its height, and the x of the parent's centre within the block.

- **Stacked group.** Applies when a team has children and **all** of them are leaves. With `n` leaves:
  - Use `k = ceil(n / maxPerColumn)` columns. `L = floor(k / 2)` columns go left of the parent's centre line (the trunk) and `k - L` go right.
  - Fill columns in visual order, left to right and top to bottom. Column sizes differ by at most 1.
  - Each column is as wide as its widest box.
  - The columns nearest the trunk keep `siblingGap` from it, and neighbouring columns are `siblingGap` apart.
  - The first row starts `levelGap` below the parent's bottom edge. Rows within a column are `siblingGap` apart.
- **Otherwise.** Lay out child blocks side by side with `siblingGap` between them, centre the parent over the span between its first and last child centres, and put the children `levelGap` below the parent. Top-level teams are laid out as siblings in the same way.

- [ ] **Step 1: Write the failing tests**

```ts
const leaves = (n: number) => Array.from({ length: n }, (_, i) => `    L${i}:`).join('\n');
const tree = parseTeams(`A:\n  B:\n${leaves(10)}\n  C:\n`).tree;
const r = compact.run(tree, resolveOptions(compact.optionsSchema), fakeCtx);
const node = (name: string) => r.nodes.find(n => n.name === name)!;
const cx = (n: PlacedNode) => shapeCenter(n.shape).x;
it('stacks an all-leaf group into ceil(10/8)=2 columns, one each side of the trunk', () => {
  const ls = r.nodes.filter(n => n.name.startsWith('L'));
  expect(ls.every(n => n.stacked)).toBe(true);
  const left = ls.filter(n => cx(n) < cx(node('B'))), right = ls.filter(n => cx(n) > cx(node('B')));
  expect([left.length, right.length]).toEqual([5, 5]);
  expect(new Set(left.map(n => (n.shape as Rect).x)).size).toBe(1);
});
it('mixed groups are not stacked', () => expect([node('B').stacked, node('C').stacked]).toEqual([false, false]));
it('leaves fill columns left to right, top to bottom', () => {
  const [l0, l5] = [node('L0'), node('L5')];
  expect(cx(l0)).toBeLessThan(cx(node('B'))); expect(cx(l5)).toBeGreaterThan(cx(node('B')));
  expect((node('L1').shape as Rect).y).toBeGreaterThan((l0.shape as Rect).y);
});
it('a single-column group sits right of the trunk', () => {
  const r1 = compact.run(parseTeams('A:\n  X:\n  Y:\n').tree, resolveOptions(compact.optionsSchema), fakeCtx);
  const a = r1.nodes.find(n => n.name === 'A')!;
  expect(r1.nodes.filter(n => n.stacked).every(n => (n.shape as Rect).x > shapeCenter(a.shape).x)).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run tests/layouts/compact.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the algorithm above and register `compact`.
- [ ] **Step 4: Run all tests.** Run `npx vitest run`. Expected: PASS. The `flat150` fixture exercises 19 columns.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat: compact layout with stacked leaf columns"`

---

### Task 7: Radial layout

**Files:**
- Create: `src/layouts/radial.ts`
- Modify: `src/layouts/registry.ts`
- Test: `tests/layouts/radial.test.ts`

**Interfaces:**
- Produces: `radial: NodeLayoutPlugin`, id `'radial'`, `direction: 'outward'`, `origin: { x: 0, y: 0 }`. Options:
  - `ringSpacing`: number, 30–300, step 5, default 80
  - `nodeStyle`: select, `dots` | `boxes`, default `dots`

**Algorithm.**
- Angles: `d3.tree().size([2π, 1]).separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth)` over the invisible root.
- Ring radius for depth `d`: `R_d = max(R_{d-1} + ringSpacing, max over angularly adjacent pairs i, j at depth d of need_ij / (2·sin(Δθ_ij / 2)))`, where:
  - `need_ij = ext_i / 2 + ext_j / 2 + 4`
  - `ext` is the shape's diagonal (box mode) or `2r` (dot mode)
  - `R_0 = 0`
  - When a depth has a single node, only the first term applies.

  This guarantees that shapes don't overlap.
- Shapes: in `dots` mode, `{ kind: 'dot', r: 4 }` at the node position with the label offset 8 px outward. In `boxes` mode, a `boxFor` rect centred on the position with the label centred and `rotate: 0`.
- Dot labels: `rotate` is the angle in degrees, normalised into (−90, 90]. `anchor` is `'start'` on the right half and `'end'` on the left half. The text goes through `fitLabel` with `maxWidth = ringSpacing - 12` when a deeper ring exists, and is unlimited otherwise.

- [ ] **Step 1: Write the failing tests**

```ts
const r = radial.run(loadTree('src/samples/medium.teams.yaml'), resolveOptions(radial.optionsSchema), fakeCtx);
const dist = (n: PlacedNode) => Math.hypot(shapeCenter(n.shape).x, shapeCenter(n.shape).y);
it('outward with origin at 0,0', () => expect([r.direction, r.origin]).toEqual(['outward', { x: 0, y: 0 }]));
it('each depth sits on one ring, and rings grow by at least ringSpacing', () => {
  const rings = [1, 2, 3, 4].map(d => r.nodes.filter(n => n.depth === d).map(dist));
  rings.forEach(ring => ring.forEach(v => expect(v).toBeCloseTo(ring[0], 3)));
  for (let d = 1; d < 4; d++) expect(rings[d][0] - rings[d - 1][0]).toBeGreaterThanOrEqual(80 - 0.01);
});
it('dots mode uses dots with readable rotation', () => r.nodes.forEach(n => {
  expect(n.shape.kind).toBe('dot');
  expect(n.label.rotate > -90 && n.label.rotate <= 90).toBe(true);
}));
it('boxes mode uses rects', () => {
  const b = radial.run(loadTree('src/samples/medium.teams.yaml'), resolveOptions(radial.optionsSchema, { nodeStyle: 'boxes' }), fakeCtx);
  expect(b.nodes.every(n => n.shape.kind === 'rect')).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run tests/layouts/radial.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement and register** `radial`.
- [ ] **Step 4: Run all tests.** Run `npx vitest run`. Expected: PASS. The contract tests check `boxes` mode for overlap, including `flat150` and `long-names`.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat: radial layout"`

---

### Task 8: Nested rectangles layout

**Files:**
- Create: `src/layouts/nested-rects.ts`
- Modify: `src/layouts/registry.ts`
- Test: `tests/layouts/nested-rects.test.ts`

**Interfaces:**
- Produces: `nestedRects: NodeLayoutPlugin`, id `'nested-rects'`, `direction: 'none'`, `hasEdges: false`. Options:
  - `sizing`: select, `fit` | `leaf-count` | `equal`, default `fit`
  - `padding`: number, 0–40, step 1, default 8
  - `aspect`: select, `16:9` | `4:3` | `1:1` | `A4`, default `16:9`
- Also export `ASPECTS: Record<string, number>`: `16:9 → 16/9`, `4:3 → 4/3`, `1:1 → 1`, `A4 → 1/Math.SQRT2`. Task 9 reuses it.

**Algorithm.**
- `titleH = boxFor('X', ctx).h`.
- **`fit` mode.**
  - A leaf's size is `boxFor(name)`.
  - A parent's content is its children wrapped greedily into rows, in YAML order, with `padding` gaps. The target row width is `max(widest child, sqrt(Σ child areas · aspect))`.
  - A parent's size is `w = max(rows width, label width + 2·BOX_PAD_X) + 2·padding` and `h = titleH + rows height + 2·padding`.
  - Top-level teams wrap the same way under the invisible root, with no title.
- **Treemap modes.**
  - Use `d3.treemap().tile(d3.treemapSquarify).size([W, W / aspect]).paddingInner(padding).paddingOuter(padding).paddingTop(n => (n.depth > 0 && n.children ? titleH + padding : padding))`.
  - `leaf-count`: `sum(d => (d.children.length ? 0 : 1))`.
  - `equal`: give each node the weight `parentWeight / siblingCount`, with root weight 1, and sum only leaf weights.
  - `W = sqrt(2 · Σ over leaves of boxFor area · aspect)`.
- **Labels.** A parent's label goes in its title strip with `anchor: 'start'`. A leaf's label is centred. Both go through `fitLabel` with the rect's inner width.

- [ ] **Step 1: Write the failing tests**

```ts
const tree = parseTeams('P1:\n  a:\n  b:\n  c:\nP2:\n  d:\n').tree;
const run = (o: Options) => nestedRects.run(tree, resolveOptions(nestedRects.optionsSchema, o), fakeCtx);
const area = (r: NodeLayoutResult, name: string) => { const s = r.nodes.find(n => n.name === name)!.shape as Rect; return s.w * s.h; };
it('no edges, direction none', () => expect([run({}).hasEdges, run({}).direction]).toEqual([false, 'none']));
it('fit: leaf size equals boxFor', () => {
  const s = run({}).nodes.find(n => n.name === 'a')!.shape as Rect;
  expect([s.w, s.h]).toEqual([boxFor('a', fakeCtx).w, boxFor('a', fakeCtx).h]);
});
it('leaf-count: sibling areas follow leaf counts (padding 0)', () => {
  const r = run({ sizing: 'leaf-count', padding: 0 });
  expect(area(r, 'P1') / area(r, 'P2')).toBeCloseTo(3, 1);
});
it('equal: sibling areas are equal (padding 0)', () => {
  const r = run({ sizing: 'equal', padding: 0 });
  expect(area(r, 'P1') / area(r, 'P2')).toBeCloseTo(1, 1);
});
it.each(['16:9', '4:3', '1:1', 'A4'])('treemap bounds follow aspect %s', a => {
  const b = run({ sizing: 'leaf-count', aspect: a, padding: 0 }).bounds;
  expect(b.w / b.h).toBeCloseTo(ASPECTS[a], 2);
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run tests/layouts/nested-rects.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement and register** `nestedRects`.
- [ ] **Step 4: Run all tests.** Run `npx vitest run`. Expected: PASS. The contract tests check containment and that siblings don't overlap.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat: nested rectangles layout"`

---

### Task 9: Nested circles layout

**Files:**
- Create: `src/layouts/nested-circles.ts`
- Modify: `src/layouts/registry.ts`
- Test: `tests/layouts/nested-circles.test.ts`

**Interfaces:**
- Produces: `nestedCircles: NodeLayoutPlugin`, id `'nested-circles'`, `direction: 'none'`, `hasEdges: false`, all shapes of kind `'circle'`. Options:
  - `sizing`: as in Task 8
  - `padding`: number, 0–40, step 1, default 6

**Algorithm.**
- **`fit` mode.**
  - A leaf's radius is `measure(name).width / 2 + padding`.
  - For a parent: run `d3.packSiblings(children)`, then `e = d3.packEnclose(children)`.
  - The parent's radius is `e.r + padding + titleH`. Shift the children down by `titleH / 2` so the label fits above them.
  - Lay out recursively, then convert to absolute positions top-down.
  - Top-level teams are packed the same way under the invisible root, which isn't drawn.
- **`leaf-count` / `equal` modes.** Use `d3.pack().size([S, S]).padding(padding)`, with the same `sum` rules as Task 8. `S = sqrt(4 · Σ over leaves of (measure width / 2)²)`.
- **Labels.** A parent's label is centred near the top inside the circle: `y = cy - r + padding + titleH / 2`. A leaf's label is centred. Both go through `fitLabel` with `maxWidth = 2·r - 2·padding` (at least 0).

- [ ] **Step 1: Write the failing tests**

```ts
it('fit: leaf radius = half label width + padding', () => {
  const r = nestedCircles.run(parseTeams('P:\n  abcd:\n').tree, resolveOptions(nestedCircles.optionsSchema), fakeCtx);
  expect((r.nodes.find(n => n.name === 'abcd')!.shape as { r: number }).r).toBeCloseTo(24 / 2 + 6);
});
it('leaf-count: every leaf has the same radius', () => {
  const r = nestedCircles.run(loadTree('src/samples/medium.teams.yaml'), resolveOptions(nestedCircles.optionsSchema, { sizing: 'leaf-count' }), fakeCtx);
  const radii = r.nodes.filter(n => !r.nodes.some(m => m.parentId === n.id)).map(n => (n.shape as { r: number }).r);
  radii.forEach(x => expect(x).toBeCloseTo(radii[0], 3));
});
it('all shapes are circles and hasEdges is false', () => { /* run on small sample, assert */ });
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run tests/layouts/nested-circles.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement and register** `nestedCircles`.
- [ ] **Step 4: Run all tests.** Run `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat: nested circles layout"`

---

### Task 10: Anchor geometry, five anchor rules and the anchor contract

**Files:**
- Create: `src/anchors/geometry.ts`, `src/anchors/registry.ts`, `src/anchors/{auto,center,fixed-sides,nearest-sides,boundary}.ts`
- Test: `tests/anchors/geometry.test.ts`, `tests/anchors/anchors.test.ts`, `tests/contract/anchors.contract.test.ts`

**Interfaces:**
- Consumes: `PlacedNode`, `AnchorInput`, `EdgeGroup`, `shapeCenter`, `findPlugin`.
- Produces:
  ```ts
  function sidePoint(shape: Shape, side: Side): Point          // rect: side midpoint; circle/dot: top/bottom/left/right point on the circle
  function boundaryPoint(shape: Shape, toward: Point): Point   // where the ray from the centre toward `toward` crosses the outline; the centre if toward == centre
  const anchors: AnchorPlugin[]                                 // ids: 'auto', 'center', 'fixed-sides', 'nearest-sides', 'boundary'
  ```
  - Every anchor returns `{ parent, edges }` with one edge per input child, in input order.
  - `fixed-sides` options: `parentSide` (select `top|bottom|left|right`, default `bottom`) and `childSide` (same choices, default `top`). The other anchors have no options.
  - `auto` rules:
    - `down`: parent `bottom`, child `top`.
    - `right`: parent `right`, child `left`.
    - `outward` or `none`: `boundary` points at both ends.
    - For a `stacked` child: the parent end is `bottom`, and the child end is the child's side facing the parent's centre x: `left` if the child's centre x is greater than the parent's centre x, otherwise `right`.
  - `nearest-sides`: of the 16 side-midpoint pairs, pick the one with the shortest distance; break ties by order `top, bottom, left, right`.
  - `boundary`: `from = boundaryPoint(parent, childCentre)`, `to = boundaryPoint(child, parentCentre)`.
  - Each `AnchorPoint.side` is the side used, or `'center'` or `'boundary'`.

- [ ] **Step 1: Write the failing tests**

```ts
// geometry.test.ts
const R: Shape = { kind: 'rect', x: 0, y: 0, w: 40, h: 20 };
const C: Shape = { kind: 'circle', cx: 0, cy: 0, r: 10 };
it('rect side midpoints', () => expect(['top', 'bottom', 'left', 'right'].map(s => sidePoint(R, s as Side)))
  .toEqual([{ x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 10 }, { x: 40, y: 10 }]));
it('circle side points', () => expect(sidePoint(C, 'right')).toEqual({ x: 10, y: 0 }));
it('rect boundary toward a far point on the diagonal hits the corner', () =>
  expect(boundaryPoint(R, { x: 60, y: 40 })).toEqual({ x: 40, y: 20 }));
it('circle boundary', () => { const p = boundaryPoint(C, { x: 30, y: 40 }); expect([p.x, p.y]).toEqual([6, 8]); });

// anchors.test.ts: build PlacedNodes P (rect 0,0,40,20) and K (rect 0,100,40,20) by hand
it('auto down: bottom → top', ...);   // from = {20,20,'bottom'}, to = {20,100,'top'}
it('auto stacked: child side faces the trunk', ...);   // K stacked at x=60 → to.side 'left'; at x=-60 → 'right'
it('fixed-sides honours options', ...);   // parentSide 'right', childSide 'left'
it('nearest-sides picks the shortest pair', ...);   // K to the right of P → right/left
it('boundary points are collinear with both centres', ...);
```

- [ ] **Step 2: Write the failing contract test.** It covers `anchors × optionVariants × [top-down, compact, radial (dots and boxes)] × [small, medium]`. For each edge it checks:
  - `from.side === 'center'` means `from` equals `shapeCenter(parent)` (within 0.01).
  - `from.side === 'boundary'` means `from` is on the parent's outline (within 0.5).
  - A named side means `from` equals `sidePoint(parent, side)` (within 0.01).
  - The same three checks for `to` against the child's shape.

  It also checks that `edges.length === children.length` and that the order is preserved.
- [ ] **Step 3: Run the tests to verify they fail.** Run `npx vitest run tests/anchors tests/contract/anchors.contract.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement** the geometry, the five anchors and the registry.
- [ ] **Step 5: Run all tests.** Run `npx vitest run`. Expected: PASS.
- [ ] **Step 6: Commit:** `git add -A && git commit -m "feat: anchor rules and anchor contract tests"`

---

### Task 11: Path helpers, straight / elbow / bus routers and the router contract

**Files:**
- Create: `src/routers/path.ts`, `src/routers/registry.ts`, `src/routers/{straight,orthogonal-elbow,orthogonal-bus}.ts`, `tests/helpers/svg-path.ts`
- Test: `tests/routers/path.test.ts`, `tests/routers/routers.test.ts`, `tests/contract/routers.contract.test.ts`

**Interfaces:**
- Consumes: `RouterInput`, `RoutedPath`, `AnchorPoint`, `findPlugin`, `anchors`, `layouts`.
- Produces:
  ```ts
  function polylinePath(points: Point[], cornerRadius: number): string
  function routeOrientation(from: AnchorPoint, to: AnchorPoint, direction: Direction): 'vertical' | 'horizontal'
  const routers: RouterPlugin[]   // this task: 'straight', 'orthogonal-elbow', 'orthogonal-bus'
  // tests/helpers/svg-path.ts
  function parsePath(d: string): { cmd: 'M' | 'L' | 'Q' | 'C' | 'A'; pts: Point[] }[]   // pts = the command's points; the last is the endpoint
  ```
  - `polylinePath` emits `M` then `L`. When `cornerRadius > 0`, each interior corner is cut short and joined with a `Q` whose control point is the corner. The radius is clamped to half of the shorter neighbouring segment. Points that repeat in a row are dropped.
  - `routeOrientation`:
    - `from.side` is `top` or `bottom`: `'vertical'`.
    - `from.side` is `left` or `right`: `'horizontal'`.
    - Otherwise: `'vertical'` for direction `down`, `'horizontal'` for `right`, and for anything else whichever axis has the larger delta (`'vertical'` on a tie).
  - `straight`: `M from L to`. No options.
  - `orthogonal-elbow`: option `cornerRadius` (number, 0–20, step 1, default 4).
    - Vertical: `from → (from.x, mid.y) → (to.x, mid.y) → to`, where `mid` is halfway between the two points.
    - Horizontal: the same using x.
    - When `to.side` is `left` or `right` and the orientation is vertical (stacked children): `from → (from.x, to.y) → to`.
  - `orthogonal-bus`: options `cornerRadius` (as in elbow) and `trunkPosition` (number, 0–1, step 0.05, default 0.5).
    - Vertical: `trunkY = from.y + trunkPosition · (nearestChildTo.y − from.y)`, where `nearestChildTo` is the child end closest to the parent along the axis. Each child path is `from → (from.x, trunkY) → (to.x, trunkY) → to`.
    - Horizontal: the same using x.
    - Stacked children: the same as elbow.
  - Each router returns one `RoutedPath` per edge: `{ fromId: parent.id, toId: child.id, d }`.

- [ ] **Step 1: Write the failing tests**

```ts
// path.test.ts
it('plain polyline', () => expect(polylinePath([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }], 0)).toBe('M0 0 L0 10 L10 10'));
it('rounded corner uses Q at the corner', () => expect(parsePath(polylinePath([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }], 4)).map(s => s.cmd)).toEqual(['M', 'L', 'Q', 'L']));
it('radius clamps to half the shorter segment', () => expect(polylinePath([{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 10, y: 2 }], 8)).toContain('L0 1'));

// routers.test.ts: hand-built group, parent bottom (20,20), children tops (0,100) and (60,120)
it('elbow vertical bends at the midpoint', ...);   // segments [M(20,20) L(20,60) L(0,60) L(0,100)] with cornerRadius 0
it('bus children share one trunk', ...);   // trunkPosition 0.5 → both paths' horizontal L has y = 60
it('elbow to a stacked child goes down then across', ...);   // to.side 'left' → points [from, (from.x,to.y), to]
```

- [ ] **Step 2: Write the failing contract test.** It covers `routers × optionVariants × anchors × [top-down, left-right, compact, radial] × medium sample`. Nodes and groups come from running the real layout and anchor plugins. It asserts:
  - one path per edge, with matching ids
  - the first point is `from` and the last endpoint is `to` (within 0.01)
  - all coordinates are finite
  - for ids starting with `orthogonal-` and `cornerRadius: 0`, every `L` segment is horizontal or vertical (|dx| < 0.01 or |dy| < 0.01) whenever the anchors are side points (not `center` or `boundary`)
- [ ] **Step 3: Run the tests to verify they fail.** Run `npx vitest run tests/routers tests/contract/routers.contract.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement** the helpers, the three routers and the registry.
- [ ] **Step 5: Run all tests.** Run `npx vitest run`. Expected: PASS.
- [ ] **Step 6: Commit:** `git add -A && git commit -m "feat: straight, elbow and bus routers with contract tests"`

---

### Task 12: Curved and radial-arc routers

**Files:**
- Create: `src/routers/curved.ts`, `src/routers/radial-arc.ts`
- Modify: `src/routers/registry.ts`
- Test: `tests/routers/curved.test.ts`

**Interfaces:**
- Produces:
  - `curved`: option `curvature` (number, 0–1, step 0.05, default 0.5).
    - The path is `M from C c1 c2 to`, with `c1 = from + n(from) · k` and `c2 = to + n(to) · k`, where `k = curvature · distance(from, to)`.
    - `n(p)` is the outward unit normal of `p.side`: top (0,−1), bottom (0,1), left (−1,0), right (1,0).
    - For `center` and `boundary`, `n(from)` points from `from` toward `to`, and `n(to)` points from `to` toward `from`.
  - `radialArc`: no options. Applies when `direction === 'outward'` and `origin` is set.
    - Let `rf`, `rt` be the distances of `from` and `to` from the origin, `af`, `at` their angles, and `rm = (rf + rt) / 2`.
    - The path is `M from L (rm, af) A rm rm 0 largeArc sweep (rm, at) L to`, with points given in polar coordinates around the origin.
    - When the direction isn't `outward`, it returns exactly what `curved` returns with default options.
- Export `curvedPath(from: AnchorPoint, to: AnchorPoint, curvature: number): string` from `curved.ts` so `radial-arc` can reuse it.

- [ ] **Step 1: Write the failing tests**

```ts
it('curved bottom→top uses vertical control points', () => {
  const [seg] = parsePath(curvedPath({ x: 0, y: 0, side: 'bottom' }, { x: 0, y: 100, side: 'top' }, 0.5)).slice(1);
  expect(seg.cmd).toBe('C'); expect(seg.pts).toEqual([{ x: 0, y: 50 }, { x: 0, y: 50 }, { x: 0, y: 100 }]);
});
it('radial-arc outward contains an A segment at the mid radius', ...);   // from (10,0) to (0,30), origin (0,0) → A radius 20
it('radial-arc falls back to curved when not outward', ...);   // compare d strings
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run tests/routers/curved.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement and register** both routers.
- [ ] **Step 4: Run all tests.** Run `npx vitest run`. Expected: PASS, including the router contract.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat: curved and radial-arc routers"`

---

### Task 13: Pipeline

**Files:**
- Create: `src/pipeline/run.ts`, `src/render/palette.ts`
- Test: `tests/pipeline/run.test.ts`

**Interfaces:**
- Consumes: `limitDepth`, `layouts`, `anchors`, `routers`, `findPlugin`, `resolveOptions`, `unionRects`, `Settings` (shape below; Task 15 implements the loader).
- Produces:
  ```ts
  // src/settings/settings.ts: create the type here (Task 15 adds the functions)
  interface Settings { maxDepth: number | null; fontSize: number; lineWidth: number;
                       layoutId: string; anchorId: string; routerId: string;
                       pluginOptions: Record<string, Options> }   // key `${axis}/${id}`, axis ∈ 'layout' | 'anchor' | 'router'
  type Axis = 'layout' | 'anchor' | 'router';
  interface Registries { layouts: NodeLayoutPlugin[]; anchors: AnchorPlugin[]; routers: RouterPlugin[] }
  const defaultRegistries: Registries;
  type PipelineResult = { ok: true; scene: Scene } | { ok: false; axis: Axis; pluginId: string; message: string };
  function runPipeline(tree: TeamTree, settings: Settings, measure: Measure, registries?: Registries): PipelineResult;
  const PALETTE: readonly string[];   // 8 light fills, index = (depth - 1) % 8
  ```
  Steps:
  1. `limitDepth`.
  2. Run the layout with `resolveOptions(schema, settings.pluginOptions['layout/<id>'])` and `ctx = { measure, fontSize }`.
  3. If `hasEdges`, group nodes by `parentId` in node order and skip top-level teams. For each group, run the anchor, then the router.
  4. Build the `Scene`: `bounds` from the layout, `style` from the settings plus `PALETTE`.

  An unknown plugin id, or an exception thrown inside a plugin, becomes `{ ok: false, axis, pluginId, message }`. For an unknown id the message is `Unknown plugin`.

- [ ] **Step 1: Write the failing tests**

```ts
const small = loadTree('src/samples/small.teams.yaml');
const S = { maxDepth: null, fontSize: 10, lineWidth: 1.5, layoutId: 'top-down', anchorId: 'auto', routerId: 'orthogonal-elbow', pluginOptions: {} };
it('default run: one node per team and one edge per non-root team', () => {
  const r = runPipeline(small, S, fakeMeasure); if (!r.ok) throw r;
  expect(r.scene.nodes).toHaveLength(15);
  expect(r.scene.edges).toHaveLength(r.scene.nodes.filter(n => n.parentId).length);
});
it('containment layouts produce no edges', () => { const r = runPipeline(small, { ...S, layoutId: 'nested-rects' }, fakeMeasure); expect(r.ok && r.scene.edges.length === 0 && !r.scene.hasEdges).toBe(true); });
it('maxDepth 1 keeps only top-level teams with hidden counts', () => {
  const r = runPipeline(small, { ...S, maxDepth: 1 }, fakeMeasure); if (!r.ok) throw r;
  expect(r.scene.nodes.every(n => n.depth === 1)).toBe(true);
  expect(r.scene.nodes.reduce((s, n) => s + n.hiddenDescendants + 1, 0)).toBe(15);
});
it('passes stored plugin options through', ...);   // pluginOptions['layout/top-down'] = { levelGap: 100 } → larger bounds.h than the default
it.each(['layout', 'anchor', 'router'] as const)('a throwing %s plugin becomes an error result', axis => {
  const boom = { id: 'boom', name: 'Boom', optionsSchema: [], run: () => { throw new Error('kaput'); } };
  const regs = { ...defaultRegistries, [`${axis}s`]: [boom] };
  const r = runPipeline(small, { ...S, [`${axis}Id`]: 'boom' }, fakeMeasure, regs as Registries);
  expect(r).toEqual({ ok: false, axis, pluginId: 'boom', message: 'kaput' });
});
it('unknown plugin id', () => expect(runPipeline(small, { ...S, routerId: 'nope' }, fakeMeasure)).toEqual({ ok: false, axis: 'router', pluginId: 'nope', message: 'Unknown plugin' }));
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run tests/pipeline/run.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `runPipeline`, `PALETTE`, and the `Settings` / `Axis` types in `src/settings/settings.ts`.
- [ ] **Step 4: Run all tests.** Run `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat: layout → anchor → router pipeline"`

---

### Task 14: SVG rendering and export filename

**Files:**
- Create: `src/render/svg.ts`, `src/render/export-name.ts`
- Test: `tests/render/svg.test.ts`, `tests/render/export-name.test.ts`

**Interfaces:**
- Consumes: `Scene`, `Settings`.
- Produces:
  ```ts
  function renderSceneMarkup(scene: Scene): string    // inner SVG markup (no <svg> wrapper), used on screen
  function renderSvgDocument(scene: Scene): string    // standalone: <svg xmlns=… viewBox=bounds±20 width height> + <style> + markup
  function exportFilename(fileName: string | null, settings: Settings): string
  ```
  Markup structure:
  1. `<g class="edges">` with one `<path class="edge" d stroke-width>` per edge.
  2. Then nodes sorted by `depth` ascending, so parents come before children. Each node is `<g class="node" data-id>` containing:
     - a shape: `<rect rx="4">` or `<circle>`, with `fill = palette[(depth - 1) % palette.length]`
     - `<title>`: the name, plus ` (+N hidden teams)` when `hiddenDescendants > 0`
     - `<text>` with `x`, `y`, `text-anchor` and a `transform="rotate(r x y)"` when `rotate ≠ 0`
     - when `hiddenDescendants > 0`, `<g class="badge">` at the shape's top-right corner (its `shapeRect`) holding a `<rect>` and `<text>+N</text>`

  All text and attribute values are XML-escaped (`& < > " '`). Fonts are set in the embedded `<style>` (`font-family: system-ui, sans-serif; font-size: <fontSize>px`).

- [ ] **Step 1: Write the failing tests**

```ts
const node = (o: Partial<PlacedNode>): PlacedNode => ({ id: 'a', name: 'A', depth: 1, parentId: null, hiddenDescendants: 0, stacked: false,
  shape: { kind: 'rect', x: 0, y: 0, w: 40, h: 20 }, label: { text: 'A', x: 20, y: 10, anchor: 'middle', rotate: 0 }, ...o });
const scene = (nodes: PlacedNode[], edges: RoutedPath[] = []): Scene =>
  ({ nodes, edges, bounds: { x: 0, y: 0, w: 100, h: 100 }, hasEdges: true, style: { fontSize: 14, lineWidth: 1.5, palette: ['#111', '#222'] } });
it('escapes markup characters in names', () => {
  const m = renderSceneMarkup(scene([node({ name: 'R&D <Ops>', label: { text: 'R&D <Ops>', x: 0, y: 0, anchor: 'middle', rotate: 0 } })]));
  expect(m).toContain('R&amp;D &lt;Ops&gt;'); expect(m).not.toContain('R&D <Ops>');
});
it('badge and tooltip for hidden descendants', () => {
  const m = renderSceneMarkup(scene([node({ hiddenDescendants: 3 })]));
  expect(m).toContain('+3'); expect(m).toContain('(+3 hidden teams)');
});
it('parents render before children', () => {
  const m = renderSceneMarkup(scene([node({ id: 'c', depth: 2 }), node({ id: 'p', depth: 1 })]));
  expect(m.indexOf('data-id="p"')).toBeLessThan(m.indexOf('data-id="c"'));
});
it('circles, palette by depth, edges with stroke width', ...);
it('document has xmlns, viewBox with a 20 px margin, and style', () => {
  const d = renderSvgDocument(scene([node({})]));
  expect(d.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  expect(d).toContain('viewBox="-20 -20 140 140"'); expect(d).toContain('<style>');
});
// export-name.test.ts
it('default name', () => expect(exportFilename(null, S)).toBe('orgchart.top-down-orthogonal-elbow-auto.svg'));
it('strips .teams.yaml and adds depth', () => expect(exportFilename('acme.teams.yaml', { ...S, layoutId: 'compact', routerId: 'orthogonal-bus', maxDepth: 3 })).toBe('acme.compact-orthogonal-bus-auto-depth3.svg'));
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run tests/render`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules.
- [ ] **Step 4: Run the tests to verify they pass.** Expected: PASS.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat: SVG rendering and export filename"`

---

### Task 15: Settings persistence

**Files:**
- Modify: `src/settings/settings.ts`
- Test: `tests/settings/settings.test.ts`

**Interfaces:**
- Consumes: `Settings`, `defaultRegistries`, `findPlugin`, `resolveOptions`.
- Produces:
  ```ts
  const STORAGE_KEY = 'orgchart-workbench/settings/v1';
  function defaultSettings(): Settings     // maxDepth null, fontSize 14, lineWidth 1.5, 'top-down' / 'auto' / 'orthogonal-elbow', pluginOptions {}
  function loadSettings(storage: Pick<Storage, 'getItem'> | null): Settings
  function saveSettings(storage: Pick<Storage, 'setItem'> | null, s: Settings): void   // never throws
  function pluginOptionsFor(s: Settings, axis: Axis, id: string): Options              // resolved, using the registries
  ```
  `loadSettings` falls back to the default for each invalid field:
  - an unknown plugin id
  - `maxDepth` that isn't `null` or an integer ≥ 1
  - `fontSize` or `lineWidth` outside their range, which are clamped

  Each stored plugin options object goes through `resolveOptions`.

- [ ] **Step 1: Write the failing tests**

```ts
const store = (v: string | null) => ({ getItem: () => v });
it('null storage → defaults', () => expect(loadSettings(null)).toEqual(defaultSettings()));
it('corrupt JSON → defaults', () => expect(loadSettings(store('{nope'))).toEqual(defaultSettings()));
it('getItem throws → defaults', () => expect(loadSettings({ getItem: () => { throw new Error('denied'); } })).toEqual(defaultSettings()));
it('unknown plugin id → default id', () => expect(loadSettings(store(JSON.stringify({ layoutId: 'gone' }))).layoutId).toBe('top-down'));
it('clamps out-of-range numbers', () => expect(loadSettings(store(JSON.stringify({ fontSize: 99 }))).fontSize).toBe(32));
it('rejects bad maxDepth', () => expect(loadSettings(store(JSON.stringify({ maxDepth: 0 }))).maxDepth).toBeNull());
it('resolves stored plugin options', () =>
  expect(loadSettings(store(JSON.stringify({ pluginOptions: { 'layout/compact': { maxPerColumn: 999 } } }))).pluginOptions['layout/compact'].maxPerColumn).toBe(50));
it('round-trips', () => { let saved = ''; const s = { ...defaultSettings(), maxDepth: 3, routerId: 'curved' };
  saveSettings({ setItem: (_k, v) => { saved = v; } }, s); expect(loadSettings(store(saved))).toEqual(s); });
it('saveSettings swallows storage errors', () => expect(() => saveSettings({ setItem: () => { throw new Error('quota'); } }, defaultSettings())).not.toThrow());
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run tests/settings`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests to verify they pass.** Expected: PASS.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat: settings persistence with validation"`

---

### Task 16: View controller and fit transform

**Files:**
- Create: `src/app/controller.ts`, `src/ui/fit.ts`
- Test: `tests/app/controller.test.ts`, `tests/ui/fit.test.ts`

**Interfaces:**
- Consumes: `parseTeams`, `treeDepth`, `runPipeline`, `Registries`.
- Produces:
  ```ts
  interface View { scene: Scene | null; stale: boolean; empty: boolean; parseErrors: ParseError[];
                   pluginError: { axis: Axis; pluginId: string; message: string } | null; treeDepth: number }
  function computeView(text: string, settings: Settings, measure: Measure, prev: View | null, registries?: Registries): View
  function fitTransform(bounds: Rect, viewport: { width: number; height: number }, margin?: number /* 20 */): { k: number; x: number; y: number }
  ```
  `computeView` behaviour:
  - **Parse errors:** `scene: prev?.scene ?? null`, `stale` is true when that scene is non-null, `treeDepth: prev?.treeDepth ?? 0`.
  - **Zero roots:** `empty: true`, `scene: null`.
  - **Plugin error:** keep the previous scene, `stale: true`, set `pluginError`.
  - **Success:** `stale: false`, no errors.

  `fitTransform` scales the bounds plus margin to fit the viewport and centres them. `k` is capped at 2, so tiny charts aren't blown up.

- [ ] **Step 1: Write the failing tests**

```ts
const ok = 'A:\n  B:\n';
it('valid text → fresh scene and depth', () => { const v = computeView(ok, defaultSettings(), fakeMeasure, null);
  expect([v.stale, v.empty, v.treeDepth, v.scene!.nodes.length]).toEqual([false, false, 2, 2]); });
it('broken YAML keeps the last good scene, marked stale', () => {
  const good = computeView(ok, defaultSettings(), fakeMeasure, null);
  const bad = computeView('A:\n  B: [', defaultSettings(), fakeMeasure, good);
  expect(bad.scene).toBe(good.scene); expect(bad.stale).toBe(true); expect(bad.parseErrors.length).toBeGreaterThan(0);
});
it('broken YAML with no history → no scene, not stale', () => expect(computeView('A: [', defaultSettings(), fakeMeasure, null)).toMatchObject({ scene: null, stale: false }));
it('empty text → empty state', () => expect(computeView('', defaultSettings(), fakeMeasure, null)).toMatchObject({ empty: true, scene: null }));
it('plugin error keeps the last scene and reports it', ...);   // injected throwing registry, as in Task 13
// fit.test.ts
it('centres and scales to fit', () => expect(fitTransform({ x: 0, y: 0, w: 960, h: 460 }, { width: 1000, height: 500 })).toEqual({ k: 1, x: 20, y: 20 }));
it('caps zoom at 2', () => expect(fitTransform({ x: 0, y: 0, w: 10, h: 10 }, { width: 1000, height: 1000 }).k).toBe(2));
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run tests/app tests/ui/fit.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules.
- [ ] **Step 4: Run the tests to verify they pass.** Expected: PASS.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat: view controller and fit transform"`

---

### Task 17: UI shell: editor, chart, messages

**Files:**
- Create: `src/measure/canvas.ts`, `src/ui/app-state.svelte.ts`, `src/ui/Editor.svelte`, `src/ui/Chart.svelte`, `src/ui/MessageBar.svelte`
- Modify: `src/App.svelte`

**Interfaces:**
- Consumes: `computeView`, `fitTransform`, `renderSceneMarkup`, `loadSettings`, `saveSettings`, `defaultSettings`.
- Produces:
  - `createCanvasMeasure(fontFamily = 'system-ui, sans-serif'): Measure`, cached per `fontSize + text`. Height is `fontSize · 1.2`.
  - `AppState` (Svelte 5 class with `$state` fields), exported as the singleton `app`:
    - Fields: `text`, `fileName: string | null`, `fileHandle: FileSystemFileHandle | null`, `dirty`, `settings`, `view`, `fitToken: number`.
    - `setText(t)`: sets `dirty`, and recomputes after 200 ms of no further calls.
    - `setSettings(patch)`: recomputes at once and calls `saveSettings(localStorage, …)`. It bumps `fitToken` when `layoutId` or `maxDepth` changes.
    - `loadText(text, name, handle)`: recomputes at once, `dirty = false`, bumps `fitToken`.
    - `requestFit()`: bumps `fitToken`.
    - `loadSample(size: 'small' | 'medium' | 'large')`: calls `loadText(raw, null, null)`. Import the samples with `import small from '../samples/small.teams.yaml?raw'`, and so on.
  - Test ids: `editor`, `chart`, `error-bar`, `stale-badge`, `empty-state`, `empty-load-sample` (which calls `app.loadSample('small')`).

- [ ] **Step 1: Implement `App.svelte`.** A three-column CSS grid: editor (min 280 px), chart (flexible), sidebar (300 px, a placeholder until Task 18), with the toolbar row on top (a placeholder until Task 19).
- [ ] **Step 2: Implement `Editor.svelte`.** CodeMirror 6 with `basicSetup` and `yaml()`. On change, call `app.setText`. Push `view.parseErrors` as lint diagnostics with `setDiagnostics`, mapping each 1-based line to `doc.line(n).from…to`. When `app.text` is replaced by `loadText`, replace the document without firing `setText`.
- [ ] **Step 3: Implement `Chart.svelte`.**
  - An `<svg>` with `<g transform>`, and `{@html renderSceneMarkup(scene)}` inside it.
  - d3-zoom on the `<svg>` updates the transform.
  - When `fitToken` changes, apply `fitTransform(scene.bounds, svgSize)`.
  - The `stale-badge` shows "showing last valid version", and the scene group gets `opacity: 0.4` when `view.stale`.
  - An empty state shows when `view.empty`.
- [ ] **Step 4: Implement `MessageBar.svelte`** (`error-bar`). It shows the first parse error as `Line N: message`, or a plugin error as `<Axis> plugin "<id>" failed: <message>`. It is hidden when there are no errors.
- [ ] **Step 5: Verify.** Run `npm run build`. Expected: svelte-check reports 0 errors and the build succeeds. Then run `npm run dev` and paste the small sample:
  - the chart appears
  - typing `A: [` dims it and shows the error bar
  - fixing the text restores it
  - the view doesn't jump while typing
- [ ] **Step 6: Commit:** `git add -A && git commit -m "feat: UI shell with live editor and chart"`

---

### Task 18: Sidebar: diagram settings and plugin sections

**Files:**
- Create: `src/ui/Sidebar.svelte`, `src/ui/PluginSection.svelte`, `src/ui/OptionsForm.svelte`
- Modify: `src/App.svelte`

**Interfaces:**
- Consumes: `app`, `layouts`, `anchors`, `routers`, `pluginOptionsFor`, `Settings`.
- Produces test ids: `select-max-depth`, `input-font-size`, `select-layout`, `select-anchor`, `select-router`, `input-line-width`, `section-anchors`, `section-edges` (each with `aria-disabled="true"` when `!view.scene?.hasEdges`), and `reset-layout`, `reset-anchor`, `reset-router`.

- [ ] **Step 1: Implement `OptionsForm.svelte`.** Props: `schema: OptionsSchema`, `values: Options`, `onchange(values)`. Controls:
  - number: a range input plus a number input, using min, max and step
  - select: `<select>`
  - boolean: a checkbox
- [ ] **Step 2: Implement `PluginSection.svelte`.** Props: `axis`, `plugins`, `selectedId`, `disabled`. It renders a collapsible `<details open>` with:
  - a plugin `<select>` that calls `setSettings({ [axis + 'Id']: id })`
  - an `OptionsForm` bound to `pluginOptionsFor(...)` whose changes write `pluginOptions['<axis>/<id>']`
  - a "Reset to defaults" button that deletes that key
- [ ] **Step 3: Implement `Sidebar.svelte`.**
  - A *Diagram* section:
    - **Max depth** select with options `All` (null) and `1…view.treeDepth`. If the stored value is deeper than the tree, add it as an extra option so the selection is kept.
    - **Font size** number input, 8–32.
  - Then `PluginSection` for layout, anchors (disabled when there are no edges), and edges (disabled when there are no edges). The edges section includes a **Line width** input, 0.5–6, step 0.5.
- [ ] **Step 4: Verify.** Run `npm run build` (expect success). In `npm run dev`:
  - switching each dropdown redraws
  - nested layouts grey out Anchors and Edges
  - max depth 1 shows only top-level teams with "+N" badges
  - settings survive a reload
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat: settings sidebar generated from plugin schemas"`

---

### Task 19: Files, samples, export and toolbar

**Files:**
- Create: `src/ui/files.ts`, `src/ui/Toolbar.svelte`
- Modify: `src/App.svelte` (toolbar, drag-and-drop, `beforeunload`, `document.title`), `src/ui/app-state.svelte.ts` (`newFile`, `open`, `save`, `saveAs`, `exportSvg`)
- Test: `tests/ui/files.test.ts` (`// @vitest-environment jsdom`)

**Interfaces:**
- Consumes: `app` (including `loadSample` from Task 17), `renderSvgDocument`, `exportFilename`.
- Produces:
  ```ts
  function openTeamsFile(): Promise<{ name: string; text: string; handle: FileSystemFileHandle | null } | null>   // null = cancelled
  function saveTeamsFile(text: string, handle: FileSystemFileHandle | null, suggestedName: string, forcePicker: boolean):
    Promise<{ name: string; handle: FileSystemFileHandle | null }>
  function downloadText(fileName: string, text: string, mime: string): void
  ```
  - With `window.showOpenFilePicker` available: the picker uses `types: [{ description: 'Team files', accept: { 'text/yaml': ['.yaml'] } }]`. The returned name is checked to end in `.teams.yaml`; any other name shows a warning in the message bar but still loads.
  - Without it: a hidden `<input type="file" accept=".yaml">`.
  - Save:
    - If there's a handle and `!forcePicker`, write through `createWritable()`.
    - Else, if `showSaveFilePicker` exists, use it.
    - Else, `downloadText(suggestedName, text, 'text/yaml')` and return `handle: null`.
  - Test ids: `btn-new`, `btn-open`, `btn-save`, `btn-save-as`, `btn-samples`, `sample-small`, `sample-medium`, `sample-large`, `btn-export`, `btn-fit`.
  - Title: `${dirty ? '● ' : ''}${fileName ?? 'Untitled'} — OrgChart Layout Workbench`.
  - `beforeunload` calls `preventDefault()` when the file is dirty.
  - File read or write errors show `File error: <message>` in the message bar and leave the editor unchanged.

- [ ] **Step 1: Write the failing tests**

```ts
it('saveTeamsFile falls back to download without the File System Access API', async () => {
  delete (window as any).showSaveFilePicker;
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
  const r = await saveTeamsFile('A:\n', null, 'acme.teams.yaml', false);
  expect(r).toEqual({ name: 'acme.teams.yaml', handle: null }); expect(click).toHaveBeenCalled();
});
it('saveTeamsFile writes through an existing handle', async () => {
  const write = vi.fn(), close = vi.fn();
  const handle = { name: 'x.teams.yaml', createWritable: async () => ({ write, close }) } as any;
  expect(await saveTeamsFile('A:\n', handle, 'ignored', false)).toEqual({ name: 'x.teams.yaml', handle });
  expect(write).toHaveBeenCalledWith('A:\n'); expect(close).toHaveBeenCalled();
});
it('downloadText sets the file name', () => { /* spy on anchor click, assert download attribute */ });
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run tests/ui/files.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `files.ts`, the toolbar, the samples menu, drag-and-drop (first dropped file, read with `file.text()`, `handle: null`), and export.
  - Export: `downloadText(exportFilename(fileName, settings), renderSvgDocument(view.scene), 'image/svg+xml')`. It's disabled when there's no scene.
  - New and Samples ask "Discard unsaved changes?" via `confirm()` when the file is dirty.
- [ ] **Step 4: Run all tests.** Run `npx vitest run && npm run build`. Expected: PASS and a successful build.
- [ ] **Step 5: Commit:** `git add -A && git commit -m "feat: open/save, samples, drag-and-drop and SVG export"`

---

### Task 20: Browser smoke tests and benchmark

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`, `bench/pipeline.bench.ts`, `tests/helpers/generate.ts`
- Modify: `vite.config.ts` (add `benchmark: { include: ['bench/**/*.bench.ts'] }` under `test`)

**Interfaces:**
- Consumes: all the UI test ids from Tasks 17–19, `runPipeline`, `defaultRegistries`, `fakeMeasure`.
- Produces: `generateTree(count: number, branching: number): TeamTree`, a breadth-first balanced tree with names `T<i>`.

- [ ] **Step 1: Configure Playwright.** `webServer: { command: 'npm run build && npm run preview', port: 4173 }`, Chromium only. Run `npx playwright install chromium`.
- [ ] **Step 2: Write the smoke tests.** One test each:
  1. **Sample:** click `btn-samples`, then `sample-medium`. `chart` contains 50 `g.node`.
  2. **Live edit:** focus `editor` and append `\nNewTeam:`. Within 1 s, `chart` contains a node titled `NewTeam`.
  3. **Broken YAML:** append `\nBroken: [`. `error-bar` is visible and contains `Line`, `stale-badge` is visible, and the node count is unchanged.
  4. **Every axis:** for each option in `select-layout`, `select-anchor` and `select-router`, select it. No `error-bar` appears and `g.node` count > 0.
  5. **Depth:** pick `1` in `select-max-depth`. Every `g.node` has a badge or is a leaf, and the count equals the number of top-level teams.
  6. **Export:** `page.waitForEvent('download')` after clicking `btn-export`. The filename matches `/^orgchart\..+\.svg$/`, and the content starts with `<svg xmlns`.
- [ ] **Step 3: Run the smoke tests.** Run `npm run e2e`. Expected: 6 passed.
- [ ] **Step 4: Write the benchmark** `bench/pipeline.bench.ts`. For each combination of layouts × anchors × routers, add `bench(\`${l}/${a}/${r} large\`, () => runPipeline(large, S, fakeMeasure))`, plus one run of the default combination on `generateTree(1000, 6)`.
- [ ] **Step 5: Run the benchmark.** Run `npm run bench`. Expected: it completes and prints a table. Compare the 150-team means to the 50 ms target and mention the results in the commit message. The benchmark is not a gate.
- [ ] **Step 6: Commit:** `git add -A && git commit -m "test: browser smoke tests and pipeline benchmark"`
