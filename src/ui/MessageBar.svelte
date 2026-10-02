<script lang="ts">
  import { app } from './app-state.svelte';

  const AXIS_LABEL = { layout: 'Layout', anchor: 'Anchor', router: 'Router' } as const;

  const message = $derived.by(() => {
    const { parseErrors, pluginError } = app.view;
    if (parseErrors.length > 0) return `Line ${parseErrors[0].line}: ${parseErrors[0].message}`;
    if (pluginError) {
      return `${AXIS_LABEL[pluginError.axis]} plugin "${pluginError.pluginId}" failed: ${pluginError.message}`;
    }
    return null;
  });
</script>

{#if message}
  <div class="error-bar" data-testid="error-bar" role="alert">{message}</div>
{/if}

<style>
  .error-bar {
    padding: 8px 12px;
    background: #fef2f2;
    color: #991b1b;
    border-top: 1px solid #fecaca;
    font-size: 13px;
  }
</style>
