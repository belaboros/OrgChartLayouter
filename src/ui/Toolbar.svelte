<script lang="ts">
  import { app } from './app-state.svelte';

  let samples: HTMLDetailsElement;

  function pick(size: 'small' | 'medium' | 'large'): void {
    samples.open = false;
    app.openSample(size);
  }
</script>

<button data-testid="btn-new" onclick={() => app.newFile()}>New</button>
<button data-testid="btn-open" onclick={() => app.open()}>Open</button>
<button data-testid="btn-save" onclick={() => app.save()}>Save</button>
<button data-testid="btn-save-as" onclick={() => app.saveAs()}>Save As</button>
<details class="samples" bind:this={samples}>
  <summary data-testid="btn-samples">Samples</summary>
  <div class="menu">
    <button data-testid="sample-small" onclick={() => pick('small')}>Small (15 teams)</button>
    <button data-testid="sample-medium" onclick={() => pick('medium')}>Medium (50 teams)</button>
    <button data-testid="sample-large" onclick={() => pick('large')}>Large (150 teams)</button>
  </div>
</details>
<span class="spacer"></span>
<button data-testid="btn-fit" onclick={() => app.requestFit()}>Fit</button>
<button data-testid="btn-export" disabled={!app.view.scene} onclick={() => app.exportSvg()}>Export SVG</button>

<style>
  .samples { position: relative; display: inline-block; }
  summary { cursor: pointer; padding: 2px 8px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; list-style: none; }
  .menu { position: absolute; z-index: 10; top: 100%; left: 0; display: flex; flex-direction: column; background: #fff; border: 1px solid #d1d5db; border-radius: 4px; }
  .menu button { border: 0; text-align: left; white-space: nowrap; }
  .spacer { flex: 1; }
</style>
