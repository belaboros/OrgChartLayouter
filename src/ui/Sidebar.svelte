<script lang="ts">
  import { app } from './app-state.svelte';
  import { layouts } from '../layouts/registry';
  import { anchors } from '../anchors/registry';
  import { routers } from '../routers/registry';
  import PluginSection from './PluginSection.svelte';
  import { parseClamped } from './number-input';

  const noEdges = $derived(!app.view.scene?.hasEdges);
  const depthOptions = $derived.by(() => {
    const n = Math.max(app.view.treeDepth, app.settings.maxDepth ?? 0);
    return Array.from({ length: n }, (_, i) => String(i + 1));
  });

  function commitField(el: HTMLInputElement, current: number, min: number, max: number, step: number, apply: (n: number) => void): void {
    const n = parseClamped(el.value, min, max, step);
    if (n === null) {
      el.value = String(current);
      return;
    }
    el.value = String(n);
    apply(n);
  }
</script>

<details open>
  <summary>Diagram</summary>
  <div class="field">
    <label for="max-depth">Max depth</label>
    <select
      id="max-depth"
      data-testid="select-max-depth"
      value={app.settings.maxDepth === null ? '' : String(app.settings.maxDepth)}
      onchange={(e) => {
        const v = e.currentTarget.value;
        app.setSettings({ maxDepth: v === '' ? null : Number(v) });
      }}
    >
      <option value="">All</option>
      {#each depthOptions as d (d)}
        <option value={d}>{d}</option>
      {/each}
    </select>
  </div>
  <div class="field">
    <label for="font-size">Font size</label>
    <input
      id="font-size"
      type="number"
      min="8"
      max="32"
      step="1"
      data-testid="input-font-size"
      value={app.settings.fontSize}
      onchange={(e) => commitField(e.currentTarget, app.settings.fontSize, 8, 32, 1, (n) => app.setSettings({ fontSize: n }))}
    />
  </div>
</details>

<PluginSection axis="layout" title="Node layout" plugins={layouts} selectedId={app.settings.layoutId} />
<PluginSection
  axis="anchor"
  title="Anchors"
  plugins={anchors}
  selectedId={app.settings.anchorId}
  disabled={noEdges}
  sectionTestId="section-anchors"
/>
<PluginSection
  axis="router"
  title="Edges"
  plugins={routers}
  selectedId={app.settings.routerId}
  disabled={noEdges}
  sectionTestId="section-edges"
>
  <div class="field">
    <label for="line-width">Line width</label>
    <input
      id="line-width"
      type="number"
      min="0.5"
      max="6"
      step="0.5"
      disabled={noEdges}
      data-testid="input-line-width"
      value={app.settings.lineWidth}
      onchange={(e) => commitField(e.currentTarget, app.settings.lineWidth, 0.5, 6, 0.5, (n) => app.setSettings({ lineWidth: n }))}
    />
  </div>
</PluginSection>

<style>
  details { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
  summary { font-weight: 600; font-size: 14px; cursor: pointer; margin-bottom: 6px; }
  .field { display: grid; gap: 2px; margin: 6px 0; font-size: 13px; }
</style>
