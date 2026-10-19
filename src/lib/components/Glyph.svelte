<script lang="ts">
  import type { State, Trend } from '#lib/types.js';

  let { trend, state }: { trend: Trend; state: State } = $props();
</script>

<svg
  viewBox="0 0 18 18"
  aria-hidden="true"
  style:--fill="var(--state-{state})"
  style:--edge={state === 'high' ? 'var(--ink)' : 'var(--map-halo)'}
>
  {#if trend === 'rising'}
    <path d="M9 3 16 15H2Z" />
  {:else if trend === 'falling'}
    <path d="M9 15 16 3H2Z" />
  {:else if trend === 'steady'}
    <rect x="2" y="6.5" width="14" height="5" rx="1.5" />
  {:else}
    <circle cx="9" cy="9" r="4" />
  {/if}
</svg>

<style>
  svg {
    flex: none;
    width: 1.1em;
    height: 1.1em;
    fill: var(--fill);
    stroke: var(--edge);
    stroke-width: 1.5;
    stroke-linejoin: round;
  }
</style>
