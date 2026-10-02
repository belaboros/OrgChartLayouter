# OrgChart Layout Workbench

A browser workbench for trying out automatic org-chart layouts. Type or open a team hierarchy in
the YAML editor on the left, and the chart on the right redraws as you type. The sidebar picks the
node layout, the edge anchors and the edge router, and their options. Export saves the chart as SVG.

Everything runs client-side: no server and no network requests. `npm run build` produces a static
site that you can host anywhere.

## Quick start

```sh
npm install
npm run dev
```

Then open the URL that Vite prints. The toolbar has small, medium and large sample charts. You can
open and save `.teams.yaml` files, or drop one onto the window.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm test` | Unit, contract and app-state tests (Vitest) |
| `npm run e2e` | Browser smoke tests (Playwright). It builds and serves the app on port 4173. Run `npx playwright install chromium` once first. |
| `npm run bench` | Pipeline benchmark on the 150-team sample (target: under 50 ms per run) |
| `npm run build` | Type check (`svelte-check`), then a static build into `dist/` |
| `npm run preview` | Serve the built `dist/` on port 4173 |

## The `.teams.yaml` format

A file is a nested mapping of team names, and nothing else:

```yaml
Engineering:
  Platform:
    Infrastructure:
    Observability:
  R&D:
Sales:
  EMEA:
    DACH:
    Nordics:
"2024":
```

Rules:

- Each key is a team. Its value is a mapping of its sub-teams.
- An empty value means the team is a leaf.
- Lists, scalar values and empty names are errors.
- Sibling names must be unique. The same name may appear under different parents.
- Quote names that YAML would read as a number or a boolean, for example `"2024":` or `"true":`.
- Names must not contain control characters (tab is allowed).

Errors are shown with their line number. While the text is broken, the last good chart stays
visible and is marked as stale.

## Plugins

A chart is drawn in three steps, and each step is a plugin axis:

1. **Layouts** (`src/layouts/`) place the teams: top-down, left-right, compact, radial, nested
   rectangles and nested circles.
2. **Anchors** (`src/anchors/`) choose where each edge leaves the parent and enters the child.
3. **Routers** (`src/routers/`) draw the edge path between two anchors. They emit absolute
   SVG path commands only (`M L Q C A`).

To add a plugin:

1. Write one file in that axis's folder that exports a plugin object with an `id`, a `name`, an
   `optionsSchema` and a `run` function. The types are in `src/plugins/types.ts`.
2. Add one line for it to that axis's `registry.ts`.

That is all. The sidebar builds its controls from `optionsSchema`, and the contract tests in
`tests/contract/` run every registered plugin against the shared test trees.

## Project layout

```
src/
  model/      YAML parsing and the team tree
  layouts/    node layout plugins and their registry
  anchors/    anchor plugins and their registry
  routers/    edge router plugins and their registry
  plugins/    plugin types and option handling
  pipeline/   depth limiting, edge grouping and the full layout run
  render/     SVG markup, palette and export filename
  app/        view computation (scene, errors, stale state)
  ui/         Svelte components, app state, file open/save
  settings/   settings persisted in localStorage
  samples/    the small, medium and large sample charts
tests/        Vitest tests; helpers/ and fixtures/ are shared
e2e/          Playwright smoke tests
bench/        pipeline benchmark
docs/         design spec and implementation plan
```
