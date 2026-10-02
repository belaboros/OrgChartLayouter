<script lang="ts">
  import { untrack } from 'svelte';
  import Editor from './ui/Editor.svelte';
  import Chart from './ui/Chart.svelte';
  import MessageBar from './ui/MessageBar.svelte';
  import Sidebar from './ui/Sidebar.svelte';
  import Toolbar from './ui/Toolbar.svelte';
  import Splitter from './ui/Splitter.svelte';
  import { app } from './ui/app-state.svelte';
  import {
    DIVIDER, MIN_EDITOR, MIN_SIDEBAR, defaultWidths, fitToWindow, resizeEditor, resizeSidebar, sideSpace, type PanelWidths,
  } from './ui/panel-widths';

  let total = $state(window.innerWidth);
  let widths = $state<PanelWidths>(defaultWidths(window.innerWidth));
  let dragStart: PanelWidths = { editor: 0, sidebar: 0 };
  const space = $derived(sideSpace(total));

  // Window resizes: keep every panel on screen and the chart at its minimum.
  $effect(() => {
    const t = total;
    untrack(() => { widths = fitToWindow(widths, t); });
  });

  $effect(() => {
    document.title = `${app.dirty ? '● ' : ''}${app.fileName ?? 'Untitled'} — OrgChart Layout Workbench`;
  });

  $effect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (app.dirty) e.preventDefault();
    };
    const onDragOver = (e: DragEvent): void => e.preventDefault();
    const onDrop = (e: DragEvent): void => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) void app.openDropped(file);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  });
</script>

<div
  class="app"
  bind:clientWidth={total}
  style:grid-template-columns="{widths.editor}px {DIVIDER}px minmax(0, 1fr) {DIVIDER}px {widths.sidebar}px"
>
  <div class="toolbar" data-testid="toolbar"><Toolbar /></div>
  <div class="editor-col" data-testid="editor-col">
    <Editor />
    <MessageBar />
  </div>
  <Splitter
    label="Resize editor"
    testid="divider-editor"
    value={widths.editor}
    min={MIN_EDITOR}
    max={Math.max(MIN_EDITOR, space - widths.sidebar)}
    onstart={() => (dragStart = widths)}
    ondrag={(dx) => (widths = resizeEditor(dragStart, dx, total))}
    onstep={(dx) => (widths = resizeEditor(widths, dx, total))}
  />
  <Chart />
  <Splitter
    label="Resize sidebar"
    testid="divider-sidebar"
    value={widths.sidebar}
    min={MIN_SIDEBAR}
    max={Math.max(MIN_SIDEBAR, space - widths.editor)}
    onstart={() => (dragStart = widths)}
    ondrag={(dx) => (widths = resizeSidebar(dragStart, dx, total))}
    onstep={(dx) => (widths = resizeSidebar(widths, dx, total))}
  />
  <div class="sidebar" data-testid="sidebar"><Sidebar /></div>
</div>

<style>
  :global(html, body, #app) { height: 100%; margin: 0; }
  :global(body) { font-family: system-ui, sans-serif; color: #1f2937; background: #fff; }
  .app {
    height: 100%;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }
  .toolbar {
    grid-column: 1 / -1; padding: 8px 12px; min-height: 20px; display: flex; align-items: center; gap: 8px;
    border-bottom: 1px solid #e5e7eb; background: #f9fafb; font-size: 14px;
  }
  .editor-col { display: grid; grid-template-rows: minmax(0, 1fr) auto; min-height: 0; min-width: 0; }
  .sidebar { background: #f9fafb; overflow-y: auto; min-width: 0; }
</style>
