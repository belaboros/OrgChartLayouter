<script lang="ts">
  import Editor from './ui/Editor.svelte';
  import Chart from './ui/Chart.svelte';
  import MessageBar from './ui/MessageBar.svelte';
  import Sidebar from './ui/Sidebar.svelte';
  import Toolbar from './ui/Toolbar.svelte';
  import { app } from './ui/app-state.svelte';

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

<div class="app">
  <div class="toolbar" data-testid="toolbar"><Toolbar /></div>
  <div class="editor-col">
    <Editor />
    <MessageBar />
  </div>
  <Chart />
  <div class="sidebar" data-testid="sidebar"><Sidebar /></div>
</div>

<style>
  :global(html, body, #app) { height: 100%; margin: 0; }
  :global(body) { font-family: system-ui, sans-serif; color: #1f2937; background: #fff; }
  .app {
    height: 100%;
    display: grid;
    grid-template-columns: minmax(280px, 1fr) 2fr 300px;
    grid-template-rows: auto minmax(0, 1fr);
  }
  .toolbar {
    grid-column: 1 / -1; padding: 8px 12px; min-height: 20px; display: flex; align-items: center; gap: 8px;
    border-bottom: 1px solid #e5e7eb; background: #f9fafb; font-size: 14px;
  }
  .editor-col { display: grid; grid-template-rows: minmax(0, 1fr) auto; min-height: 0; border-right: 1px solid #e5e7eb; }
  .sidebar { border-left: 1px solid #e5e7eb; background: #f9fafb; overflow-y: auto; }
</style>
