<script lang="ts">
  interface Props {
    label: string;
    testid: string;
    /** Width of the panel this divider resizes, and its allowed range (for assistive tech). */
    value: number;
    min: number;
    max: number;
    /** A drag starts; the parent remembers the widths it measures dx against. */
    onstart: () => void;
    /** Pointer distance from where the drag started. */
    ondrag: (dx: number) => void;
    /** Keyboard nudge, relative to the current position. */
    onstep: (dx: number) => void;
  }
  let { label, testid, value, min, max, onstart, ondrag, onstep }: Props = $props();

  const KEY_STEP = 10;
  let startX: number | null = null;

  function down(e: PointerEvent): void {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startX = e.clientX;
    document.body.classList.add('resizing');
    onstart();
  }

  function move(e: PointerEvent): void {
    if (startX !== null) ondrag(e.clientX - startX);
  }

  function up(): void {
    startX = null;
    document.body.classList.remove('resizing');
  }

  function key(e: KeyboardEvent): void {
    if (e.key === 'ArrowLeft') onstep(-KEY_STEP);
    else if (e.key === 'ArrowRight') onstep(KEY_STEP);
    else return;
    e.preventDefault();
  }
</script>

<!-- A focusable separator is the WAI-ARIA "window splitter" pattern; Svelte's a11y lint treats every separator as static. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="splitter"
  role="separator"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={Math.round(value)}
  aria-valuemin={Math.round(min)}
  aria-valuemax={Math.round(max)}
  tabindex="0"
  data-testid={testid}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onkeydown={key}
></div>

<style>
  .splitter {
    cursor: col-resize; background: #e5e7eb; touch-action: none; outline: none;
  }
  .splitter:hover, .splitter:focus-visible, :global(body.resizing) .splitter:active { background: #93c5fd; }
  :global(body.resizing) { cursor: col-resize; user-select: none; }
</style>
