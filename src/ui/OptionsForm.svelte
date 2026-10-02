<script lang="ts">
  import type { Options, OptionsSchema } from '../plugins/types';
  import { parseClamped } from './number-input';

  interface Props {
    axis: string;
    schema: OptionsSchema;
    values: Options;
    disabled?: boolean;
    onchange: (values: Options) => void;
  }
  let { axis, schema, values, disabled = false, onchange }: Props = $props();

  function set(key: string, value: unknown): void {
    onchange({ ...values, [key]: value });
  }

  function commitRange(key: string, raw: string, min: number, max: number, step: number): void {
    const n = parseClamped(raw, min, max, step);
    if (n !== null) set(key, n);
  }

  function commitField(el: HTMLInputElement, key: string, min: number, max: number, step: number): void {
    const n = parseClamped(el.value, min, max, step);
    if (n === null) {
      el.value = String(values[key]);
      return;
    }
    el.value = String(n);
    set(key, n);
  }
</script>

{#each schema as spec (spec.key)}
  <div class="opt">
    <label for="opt-{axis}-{spec.key}">{spec.label}</label>
    {#if spec.type === 'number'}
      <div class="num">
        <input
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={values[spec.key] as number}
          {disabled}
          aria-label="{spec.label} slider"
          oninput={(e) => commitRange(spec.key, e.currentTarget.value, spec.min, spec.max, spec.step)}
        />
        <input
          id="opt-{axis}-{spec.key}"
          type="number"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={values[spec.key] as number}
          {disabled}
          data-testid="option-{axis}-{spec.key}"
          onchange={(e) => commitField(e.currentTarget, spec.key, spec.min, spec.max, spec.step)}
        />
      </div>
    {:else if spec.type === 'select'}
      <select
        id="opt-{axis}-{spec.key}"
        value={values[spec.key] as string}
        {disabled}
        data-testid="option-{axis}-{spec.key}"
        onchange={(e) => set(spec.key, e.currentTarget.value)}
      >
        {#each spec.choices as c (c.value)}
          <option value={c.value}>{c.label}</option>
        {/each}
      </select>
    {:else}
      <input
        id="opt-{axis}-{spec.key}"
        type="checkbox"
        checked={values[spec.key] as boolean}
        {disabled}
        data-testid="option-{axis}-{spec.key}"
        onchange={(e) => set(spec.key, e.currentTarget.checked)}
      />
    {/if}
  </div>
{/each}

<style>
  .opt { display: grid; gap: 2px; margin: 6px 0; font-size: 13px; }
  .num { display: grid; grid-template-columns: 1fr 64px; gap: 6px; align-items: center; }
</style>
