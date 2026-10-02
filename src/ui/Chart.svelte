<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { select } from 'd3-selection';
  import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
  import { renderSceneMarkup, sceneCss } from '../render/svg';
  import { fitTransform } from './fit';
  import { app } from './app-state.svelte';

  let svgEl: SVGSVGElement;
  let size = $state({ width: 0, height: 0 });
  let transform = $state({ k: 1, x: 0, y: 0 });
  let behavior: ZoomBehavior<SVGSVGElement, unknown> | undefined;
  let appliedToken = -1;

  const scene = $derived(app.view.scene);
  const markup = $derived(
    scene ? `<style>${sceneCss(scene.style.fontSize)}</style>${renderSceneMarkup(scene)}` : '',
  );

  onMount(() => {
    behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 8])
      .on('zoom', (e) => {
        transform = { k: e.transform.k, x: e.transform.x, y: e.transform.y };
      });
    select(svgEl).call(behavior);
    const ro = new ResizeObserver(([entry]) => {
      size = { width: entry.contentRect.width, height: entry.contentRect.height };
    });
    ro.observe(svgEl);
    return () => {
      ro.disconnect();
      select(svgEl).on('.zoom', null);
    };
  });

  $effect(() => {
    const token = app.fitToken;
    const s = scene;
    const { width, height } = size;
    if (!behavior || !s || width <= 0 || height <= 0 || token === appliedToken) return;
    appliedToken = token;
    untrack(() => {
      const t = fitTransform(s.bounds, { width, height });
      select(svgEl).call(behavior!.transform, zoomIdentity.translate(t.x, t.y).scale(t.k));
    });
  });
</script>

<div class="chart" data-testid="chart">
  <svg bind:this={svgEl}>
    <g
      transform="translate({transform.x} {transform.y}) scale({transform.k})"
      style:opacity={app.view.stale ? 0.4 : 1}
    >
      {@html markup}
    </g>
  </svg>
  {#if app.view.stale}
    <div class="badge" data-testid="stale-badge">showing last valid version</div>
  {/if}
  {#if app.view.empty}
    <div class="empty" data-testid="empty-state">
      <p>Nothing to draw yet.</p>
      <button data-testid="empty-load-sample" onclick={() => app.loadSample('small')}>Load sample</button>
    </div>
  {/if}
</div>

<style>
  .chart { position: relative; height: 100%; min-height: 0; background: #fafafa; overflow: hidden; }
  svg { width: 100%; height: 100%; display: block; cursor: grab; }
  .badge {
    position: absolute; top: 8px; left: 8px; padding: 4px 8px;
    background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;
    border-radius: 4px; font-size: 12px;
  }
  .empty {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 8px; color: #6b7280;
  }
</style>
