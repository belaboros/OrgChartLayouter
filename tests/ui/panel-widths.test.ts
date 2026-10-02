import { describe, it, expect } from 'vitest';
import {
  DIVIDER, MIN_CHART, MIN_EDITOR, MIN_SIDEBAR,
  defaultWidths, fitToWindow, resizeEditor, resizeSidebar,
} from '../../src/ui/panel-widths';

const chartWidth = (w: { editor: number; sidebar: number }, total: number) => total - 2 * DIVIDER - w.editor - w.sidebar;

describe('defaultWidths', () => {
  it('gives the editor a third of the space beside a 300px sidebar', () => {
    expect(defaultWidths(1512)).toEqual({ editor: 400, sidebar: 300 });
  });
  it('never makes the editor narrower than 280px when there is room', () => {
    expect(defaultWidths(1000).editor).toBe(280);
  });
  it('fits a narrow window', () => {
    const w = defaultWidths(700);
    expect(chartWidth(w, 700)).toBeGreaterThanOrEqual(MIN_CHART);
  });
});

describe('resizeEditor', () => {
  const w = { editor: 400, sidebar: 300 };
  it('moves the editor edge by the drag distance', () => {
    expect(resizeEditor(w, 100, 1600)).toEqual({ editor: 500, sidebar: 300 });
    expect(resizeEditor(w, -100, 1600)).toEqual({ editor: 300, sidebar: 300 });
  });
  it('stops at the editor minimum', () => {
    expect(resizeEditor(w, -1000, 1600).editor).toBe(MIN_EDITOR);
  });
  it('stops where the chart would drop below its minimum', () => {
    const r = resizeEditor(w, 5000, 1600);
    expect(chartWidth(r, 1600)).toBe(MIN_CHART);
    expect(r.sidebar).toBe(300);
  });
});

describe('resizeSidebar', () => {
  const w = { editor: 400, sidebar: 300 };
  it('dragging the right divider left widens the sidebar', () => {
    expect(resizeSidebar(w, -100, 1600)).toEqual({ editor: 400, sidebar: 400 });
    expect(resizeSidebar(w, 50, 1600)).toEqual({ editor: 400, sidebar: 250 });
  });
  it('stops at the sidebar minimum', () => {
    expect(resizeSidebar(w, 1000, 1600).sidebar).toBe(MIN_SIDEBAR);
  });
  it('stops where the chart would drop below its minimum', () => {
    const r = resizeSidebar(w, -5000, 1600);
    expect(chartWidth(r, 1600)).toBe(MIN_CHART);
    expect(r.editor).toBe(400);
  });
});

describe('fitToWindow', () => {
  it('leaves widths alone when everything fits', () => {
    expect(fitToWindow({ editor: 400, sidebar: 300 }, 1600)).toEqual({ editor: 400, sidebar: 300 });
  });
  it('shrinks the editor first, then the sidebar, to keep the chart minimum', () => {
    // avail for side panels at 1012: 1012 - 12 - 200 = 800 → editor gives up 100 first
    expect(fitToWindow({ editor: 600, sidebar: 300 }, 1012)).toEqual({ editor: 500, sidebar: 300 });
    // avail 500: editor down to 200, sidebar down to 300
    expect(fitToWindow({ editor: 600, sidebar: 400 }, 712)).toEqual({ editor: 200, sidebar: 300 });
  });
  it('when even the minimums do not fit, the chart minimum wins and side panels share the rest', () => {
    const total = 500; // avail = 288 < 200 + 220
    const r = fitToWindow({ editor: 400, sidebar: 300 }, total);
    expect(chartWidth(r, total)).toBeCloseTo(MIN_CHART);
    expect(r.editor / r.sidebar).toBeCloseTo(MIN_EDITOR / MIN_SIDEBAR);
  });
  it('raises widths below their minimum when there is room', () => {
    expect(fitToWindow({ editor: 50, sidebar: 50 }, 1600)).toEqual({ editor: MIN_EDITOR, sidebar: MIN_SIDEBAR });
  });
});
