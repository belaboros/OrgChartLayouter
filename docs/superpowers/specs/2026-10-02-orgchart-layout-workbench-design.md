# OrgChart Layout Workbench — Design

Date: 2026-10-02
Status: Approved in brainstorming, awaiting spec review

## 1. Purpose

A standalone, fully client-side web app for **experimenting with automatic layouts of team hierarchies**. Users load or edit a `*.teams.yaml` file and combine interchangeable plugins on three independent axes:

1. **Node layouts:** where shapes go and what shape they are.
2. **Anchors:** where lines attach to shapes.
3. **Edge routers:** how lines are drawn between attachment points.

The app is meant to grow: adding a node layout, anchor rule or edge router is a single new file plus one registry line, with no UI changes.

### Success criteria

- A `*.teams.yaml` file can be loaded from the local file system, edited in the built-in editor, and saved.
- The chart redraws live while typing. Invalid input never blanks the chart.
- Every combination of node layout × anchor × edge router can be selected and rendered.
- The user can limit how many levels are drawn (default: unlimited), for example to see only the top 3 levels of a large organization.
- The current view can be exported as a self-contained SVG.
- A new plugin is picked up by the UI and by the contract tests without touching either.
- A full redraw of 150 teams completes in under 50 ms (target, not a gate).

### Scale

Guidelines, not limits:

| Size   | Teams   |
|--------|---------|
| Small  | ≤ 15    |
| Medium | 16–50   |
| Large  | 51–150  |

There is no hard upper limit. Subtree collapsing is out of scope for v1.

### Out of scope for v1

- People or team members. Nodes are teams only.
- Any data on a team besides its name (no colors, owners or headcounts in the file).
- PNG and PDF export.
- Server, accounts, sharing, or HR-system integration.
- Collapse/expand of individual subtrees. Only the global depth limit (section 3.1) is in scope.

## 2. Input format

Files use the `.teams.yaml` extension. The content is **nested YAML mappings of team names only**:

```yaml
Engineering:
  Platform:
    Infra:
    Tooling:
  Product:
Sales:
```

Rules:

- Every key is a team name. Its value is either empty/null (a leaf team) or a mapping of sub-teams.
- Several top-level keys are allowed. Layouts treat them as children of an invisible root, which is never drawn.
- Sibling names are unique. Duplicate keys are a YAML error and are reported as such.
- The same name may appear under different parents. Node identity is the path from the root (e.g. `Engineering/Platform/Infra`), not the name.
- Errors: a scalar value (`Infra: foo`), a list, an empty or whitespace-only key, or non-string keys. Each error is reported with its line number.

## 3. Architecture

```
 .teams.yaml ─┐
 editor text ─┴─► parse ─► TeamTree ─► Depth limit ─► Node layout ─► Anchors ─► Edge router ─► SVG renderer ─► canvas / export
```

Tech stack: TypeScript, Vite (static build), Svelte (UI), CodeMirror 6 (editor), `yaml` package (parsing with line numbers), d3-hierarchy and d3-flextree (layout algorithms), Vitest (unit and contract tests), Playwright (smoke tests).

### Modules

| Module      | Responsibility | Depends on |
|-------------|----------------|------------|
| `model/`    | YAML text → `TeamTree` plus a list of errors with line numbers. No DOM. | `yaml` |
| `measure/`  | Label width/height for the current font (canvas `measureText`, cached). Passed to plugins as a parameter so tests can inject a fake. | — |
| `layouts/`  | Node layout plugins and their registry. | `model`, d3 |
| `anchors/`  | Anchor plugins and their registry. | `layouts` types |
| `routers/`  | Edge router plugins and their registry. | `anchors` types |
| `pipeline/` | Applies the depth limit, runs layout → anchors → router, and catches plugin errors. | `model`, the three plugin modules |
| `render/`   | Scene → SVG. Shared by the on-screen chart and export. | pipeline types |
| `ui/`       | Svelte components and the app store. | everything above |

### Core types (indicative)

```ts
interface TeamNode { id: string; name: string; children: TeamNode[]; line: number }
interface TeamTree { roots: TeamNode[] }

type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'dot'; cx: number; cy: number; r: number };

interface PlacedNode { id: string; name: string; depth: number; parentId: string | null; hiddenDescendants: number; stacked: boolean; shape: Shape; label: LabelPlacement }
interface NodeLayoutResult { nodes: PlacedNode[]; bounds: Rect; direction: 'down' | 'right' | 'outward' | 'none'; hasEdges: boolean; origin: Point | null }

interface AnchorPoint { x: number; y: number; side: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'boundary' }
interface EdgeGroup { parent: PlacedNode; edges: { child: PlacedNode; from: AnchorPoint; to: AnchorPoint }[] }
interface RoutedPath { fromId: string; toId: string; d: string /* SVG path data */ }

// Output of pipeline/, input of render/
interface Scene { nodes: PlacedNode[]; edges: RoutedPath[]; bounds: Rect; style: { fontSize: number; lineWidth: number; palette: string[] } }

interface Plugin<In, Out> {
  id: string;
  name: string;
  optionsSchema: OptionsSchema;   // drives the settings panel
  run(input: In, options: Record<string, unknown>, ctx: Ctx): Out;
}
```

`OptionsSchema` describes each option: key, label, type (`number` with min/max/step, `select` with choices, or `boolean`), and default.

Anchors run once per parent with all its children. Each edge carries its own `from` point, so a parent can use one shared point for every edge (fixed sides) or a different point per edge (nearest sides, boundary intersection). `stacked` marks leaves placed in a compact-layout column. `origin` is the centre of a radial layout.

Routers receive one `EdgeGroup` at a time, so they can draw shared geometry such as a bus trunk.

### 3.1 Depth limit

A global **Max depth** setting decides how many levels are drawn. It is not a plugin option, so it works the same with every node layout, anchor and router.

- Levels are counted from the top: the top-level teams in the file are level 1. The invisible root is not counted.
- The default is **All**, so every team is drawn.
- When the limit is *N*, `pipeline/` prunes the tree to levels 1–*N* before the node layout runs. Plugins only ever see the pruned tree. They need no depth-limit logic, and a pruned team is a leaf to them, for example in the compact rule and in leaf-count sizing.
- Each drawn team whose children were cut off records how many teams it hides (`hiddenDescendants`). The renderer shows this as a small "+N" badge on the shape, so a pruned team can be told apart from a real leaf. The badge is also included in the tooltip and in exported SVG.
- Pruning never changes the YAML text.

## 4. Plugins

### 4.1 Shared node options

These apply to every node layout:

- Font size.
- Fill color by depth from one fixed palette.

Labels that don't fit are cut short with "…". The full name is kept as a `<title>` tooltip, including in exported SVG.

### 4.2 Node layouts (initial set)

| id | Shapes | Direction | Edges | Algorithm | Options |
|----|--------|-----------|-------|-----------|---------|
| `top-down` | rect, sized to label | down | yes | d3-flextree | sibling gap, level gap |
| `left-right` | rect, sized to label | right | yes | d3-flextree with axes swapped | sibling gap, level gap |
| `compact` | rect, sized to label | down | yes | top-down, with leaf groups stacked | sibling gap, level gap, max teams per column (default 8) |
| `radial` | dot, or small rect | outward | yes | d3 tree in polar coordinates | ring spacing, node style (dots / boxes) |
| `nested-rects` | rect | none | no | see below | sizing mode, padding, target aspect ratio |
| `nested-circles` | circle | none | no | see below | sizing mode, padding |

**Compact rule:** when *all* children of a team are leaves, they are stacked in a vertical column under it. When a group has more than *max teams per column*, it wraps into several columns side by side. Teams with a mix of leaf and non-leaf children use the plain top-down layout.

**Radial labels:** with dots, each label runs outward along its ray.

**Sizing modes** (both containment layouts):

| Mode | Nested rectangles | Nested circles |
|------|-------------------|----------------|
| Fit to content | Each leaf box is sized to its label. A parent arranges its children in rows that wrap toward the target aspect ratio, with a title strip on top and padding around them. | Each leaf radius comes from its label width. Siblings are packed with `packSiblings` and the parent is their enclosing circle (`packEnclose`) plus padding. |
| Leaf count | Squarified treemap. Area is proportional to the number of leaf descendants. Parents get title strips. | `d3.pack` weighted by leaf count. |
| Equal weight | Squarified treemap where each child gets an equal share of its parent. | `d3.pack` with equal sibling weights. |

Target aspect ratio choices: 16:9, 4:3, 1:1, A4 portrait. Parent labels in nested circles sit near the top, inside the circle.

### 4.3 Anchors (initial set)

All anchor rules know the geometry of rects, circles and dots. For a circle, "side midpoints" are the top, bottom, left and right points on its edge.

| id | Behavior | Options |
|----|----------|---------|
| `auto` | Follows the layout direction: `down` → parent bottom to child top; `right` → parent right to child left; `outward` → boundary intersection. | — |
| `center` | Center to center. | — |
| `fixed-sides` | Parent side and child side are chosen separately. | parent side, child side |
| `nearest-sides` | The pair of side midpoints closest to each other. | — |
| `boundary` | Aims at the centers but starts and ends where the line crosses each shape's outline. | — |

### 4.4 Edge routers (initial set)

| id | Behavior | Options |
|----|----------|---------|
| `straight` | A straight line per edge. | — |
| `orthogonal-elbow` | Horizontal/vertical segments with a bend halfway. | corner radius |
| `orthogonal-bus` | Siblings share one trunk line. Each child branches off it. | corner radius, trunk position (0–1 between parent and children) |
| `curved` | A cubic Bézier per edge, with control points along each anchor's side direction. | curvature |
| `radial-arc` | Follows the rings of a radial layout: a radial segment out to the radius midway between the two rings, an arc at that radius, then a radial segment in to the child. Falls back to `curved` when the layout direction is not `outward`. | — |

Shared router options: line width.

### 4.5 Compatibility

Any combination may be selected. When the node layout reports `hasEdges: false`, the Anchors and Edges sections are greyed out and no edges are drawn.

### 4.6 Adding a plugin

1. Create a file in `layouts/`, `anchors/` or `routers/` that exports a `Plugin`.
2. Add one line to that folder's `registry.ts`.

The UI dropdowns, the settings panels and the contract tests all read the registries.

## 5. User interface

### Layout

- **Toolbar:** New, Open, Save, Save As, Samples, Export SVG, Fit.
- **Left pane:** YAML editor (CodeMirror 6, YAML mode, error markers).
- **Centre:** the chart, as an SVG with pan (drag) and zoom (wheel).
- **Right sidebar:**
  - At the top, a *Diagram* section with the **Max depth** selector (section 3.1). Its choices are All, then 1 up to the deepest level in the current file. If an edit makes the file shallower than the selected limit, the selection stays and simply has no effect.
  - Below it, three collapsible sections, *Node layout*, *Anchors* and *Edges*. Each has a plugin dropdown, controls generated from the plugin's `optionsSchema`, and "reset to defaults".

### Files

- **Open:** the File System Access API picker filtered to `*.teams.yaml`. Fallback: `<input type="file">`. Files can also be dropped onto the window.
- **Save:** writes back through the file handle where supported. Otherwise downloads `<name>.teams.yaml`.
- **Save As:** always asks for a new file or name.
- **New:** an empty document.
- **Samples:** bundled files with about 15, 50 and 150 teams.
- **Unsaved changes:** a dot in the title, and a `beforeunload` warning.

### Live updates

- Redraws 200 ms after the last keystroke.
- The view stays put while typing. It resets to fit only on file load, on a node-layout change, on a max-depth change, or when **Fit** is pressed.

### Settings persistence

The max depth, the selected plugin on each axis, and every plugin's options are stored in `localStorage`, read and written inside try/catch, with defaults used if storage is unavailable. They are never written into the YAML file.

### Export

- A self-contained SVG of exactly what is on screen, with styles and font settings embedded.
- Filename: `<file-name>.<layout>-<router>-<anchor>.svg`, for example `orgchart.compact-orthogonal-bus-auto.svg`. When a depth limit is active, `-depth<N>` is appended, for example `orgchart.compact-orthogonal-bus-auto-depth3.svg`.

## 6. Error handling

| Situation | Behavior |
|-----------|----------|
| YAML syntax error | Red marker on the line and a message bar under the editor. The last valid chart stays, dimmed, labelled "showing last valid version". |
| Structure error (scalar, list, empty key) | Same as a syntax error. |
| Plugin throws | `pipeline` catches it. The message bar names the axis and plugin and shows the error text. The chart pane shows the last good render, dimmed. The rest of the app keeps working. |
| Empty document | An empty state with a "load a sample" link. |
| File read or write fails | A message bar with the reason. The editor contents are unchanged. |
| `localStorage` unavailable | Defaults are used silently. |

## 7. Testing

**Unit tests (Vitest).** Tests use a fake `measure` (fixed width per character) for deterministic results.

- `model`: valid trees, several top-level teams, repeated names under different parents, and each error type with the correct line number.
- `pipeline` depth limit:
  - All leaves the tree unchanged.
  - Limit *N* keeps exactly levels 1–*N*.
  - `hiddenDescendants` counts every hidden team below a pruned team, not just its direct children.
  - A limit deeper than the tree changes nothing.
- `render`: a tiny scene produces the expected shapes, labels, paths, `<title>` elements and "+N" badges.

**Contract tests.** These loop over the registries, so new plugins are covered automatically. Each plugin runs against the three samples with default options and with the min/max or every choice of each option. Each run is repeated with max depth All, 1 and 3.

- Node layouts:
  - every team is placed, with finite coordinates
  - tree layouts: no shapes overlap
  - containment layouts: every child is fully inside its parent and siblings don't overlap
  - `bounds` contains all shapes
- Anchors: each point lies on the shape outline, or at the centre for `center`, and on the expected side for fixed-side rules.
- Routers: each path starts and ends at its anchor points, and orthogonal routers produce only axis-aligned segments.

**Browser smoke tests (Playwright).**

- Load a sample.
- Edit the YAML and see the chart update.
- Type broken YAML and see the error with the dimmed last chart.
- Switch every axis.
- Export SVG and check that it downloads.

**Benchmark.** Every combination runs on the 150-team sample and on a generated 1,000-team tree. Timings are reported but never fail the build.
