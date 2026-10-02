<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Plugin } from '../plugins/types';
  import { app } from './app-state.svelte';
  import { pluginOptionsFor, type Axis } from '../settings/settings';
  import OptionsForm from './OptionsForm.svelte';

  interface Props {
    axis: Axis;
    title: string;
    plugins: Plugin<never, unknown>[];
    selectedId: string;
    disabled?: boolean;
    sectionTestId?: string;
    children?: Snippet;
  }
  let { axis, title, plugins, selectedId, disabled = false, sectionTestId, children }: Props = $props();

  const plugin = $derived(plugins.find((p) => p.id === selectedId));
  const values = $derived(pluginOptionsFor(app.settings, axis, selectedId));
  const key = $derived(`${axis}/${selectedId}`);
  const idField = $derived(`${axis}Id` as 'layoutId' | 'anchorId' | 'routerId');

  function onchange(next: Record<string, unknown>): void {
    app.setSettings({ pluginOptions: { ...app.settings.pluginOptions, [key]: next } });
  }

  function reset(): void {
    const { [key]: _removed, ...rest } = app.settings.pluginOptions;
    app.setSettings({ pluginOptions: rest });
  }
</script>

<details open data-testid={sectionTestId} aria-disabled={disabled ? 'true' : undefined}>
  <summary>{title}</summary>
  {#if children}{@render children()}{/if}
  <select
    aria-label="{title} plugin"
    value={selectedId}
    {disabled}
    data-testid="select-{axis}"
    onchange={(e) => app.setSettings({ [idField]: e.currentTarget.value })}
  >
    {#each plugins as p (p.id)}
      <option value={p.id}>{p.name}</option>
    {/each}
  </select>
  {#if plugin}
    <OptionsForm {axis} schema={plugin.optionsSchema} {values} {disabled} {onchange} />
  {/if}
  <button type="button" {disabled} data-testid="reset-{axis}" onclick={reset}>Reset to defaults</button>
</details>

<style>
  details { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
  details[aria-disabled='true'] { opacity: 0.5; }
  summary { font-weight: 600; font-size: 14px; cursor: pointer; margin-bottom: 6px; }
  select { width: 100%; }
  button { margin-top: 6px; }
</style>
