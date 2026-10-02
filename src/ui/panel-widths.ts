export const DIVIDER = 6;
export const MIN_EDITOR = 200;
export const MIN_SIDEBAR = 220;
export const MIN_CHART = 200;

export interface PanelWidths { editor: number; sidebar: number }

/** Space left for the editor and sidebar once the dividers and the chart minimum are taken. */
export const sideSpace = (total: number): number => Math.max(0, total - 2 * DIVIDER - MIN_CHART);

export function defaultWidths(total: number): PanelWidths {
  const sidebar = 300;
  const editor = Math.max(280, (total - sidebar - 2 * DIVIDER) / 3);
  return fitToWindow({ editor, sidebar }, total);
}

export function resizeEditor(w: PanelWidths, dx: number, total: number): PanelWidths {
  const max = Math.max(MIN_EDITOR, sideSpace(total) - w.sidebar);
  return { editor: Math.min(max, Math.max(MIN_EDITOR, w.editor + dx)), sidebar: w.sidebar };
}

/** dx is the divider movement: moving it left (negative) widens the sidebar. */
export function resizeSidebar(w: PanelWidths, dx: number, total: number): PanelWidths {
  const max = Math.max(MIN_SIDEBAR, sideSpace(total) - w.editor);
  return { editor: w.editor, sidebar: Math.min(max, Math.max(MIN_SIDEBAR, w.sidebar - dx)) };
}

/** Keeps the chart at its minimum width: shrinks the editor first, then the sidebar. */
export function fitToWindow(w: PanelWidths, total: number): PanelWidths {
  const avail = sideSpace(total);
  if (avail < MIN_EDITOR + MIN_SIDEBAR) {
    const share = avail / (MIN_EDITOR + MIN_SIDEBAR);
    return { editor: MIN_EDITOR * share, sidebar: MIN_SIDEBAR * share };
  }
  let editor = Math.max(MIN_EDITOR, w.editor);
  let sidebar = Math.max(MIN_SIDEBAR, w.sidebar);
  let over = editor + sidebar - avail;
  if (over > 0) {
    const fromEditor = Math.min(over, editor - MIN_EDITOR);
    editor -= fromEditor;
    over -= fromEditor;
    sidebar -= over > 0 ? over : 0;
  }
  return { editor, sidebar };
}
