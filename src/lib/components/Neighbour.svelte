<script lang="ts">
  import { metres, stateLabel } from '#lib/format.js';
  import { current } from '#lib/rivers.js';
  import type { Gauge, Stop } from '#lib/types.js';
  import Glyph from './Glyph.svelte';

  interface Props {
    stop: Stop;
    gauge?: Gauge;
    way: 'Upriver' | 'Downriver';
    km: number;
    now: number;
  }

  let { stop, gauge, way, km, now }: Props = $props();

  const state = $derived(current(gauge, now));
</script>

<a class="neighbour" href="/station/{stop.id}" rel={way === 'Upriver' ? 'prev' : 'next'}>
  <span class="way carved">{way}</span>
  <strong>{gauge?.name ?? stop.id}</strong>
  <span class="reading">
    <Glyph trend={state === 'unknown' ? 'unknown' : (gauge?.trend ?? 'unknown')} {state} />
    {gauge?.value === undefined ? 'No reading' : metres(gauge.value)}, {stateLabel[
      state
    ].toLowerCase()}
  </span>
  <span class="reading">{km.toFixed(1)} km away</span>
</a>

<style>
  .neighbour {
    display: grid;
    align-content: start;
    gap: var(--space-1);
    min-height: var(--tap);
    padding: var(--space-2) var(--space-3);
    text-decoration: none;
    background: var(--stone-sunk);
    border-radius: var(--radius);

    &:hover strong {
      text-decoration: underline;
    }
  }

  .way {
    font-size: 0.75rem;
    color: var(--ink-soft);
  }

  strong {
    font-size: 0.9375rem;
    line-height: 1.25;
  }

  .reading {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: 0.8125rem;
    color: var(--ink-soft);
  }
</style>
