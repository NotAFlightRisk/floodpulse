<script lang="ts">
  import { onMount } from 'svelte';
  import { stateLabel, trendLabel } from '#lib/format.js';
  import type { Shown, State, Trend } from '#lib/types.js';
  import Glyph from './Glyph.svelte';

  let { shown = $bindable() }: { shown: Shown } = $props();

  const LAYERS: [keyof Shown, string][] = [
    ['river', 'Rivers'],
    ['tidal', 'Tidal'],
    ['ground', 'Groundwater'],
    ['rain', 'Rain now'],
    ['warnings', 'Warnings'],
    ['relief', '3D relief']
  ];
  const STATES: State[] = ['high', 'normal', 'low', 'unknown'];
  const TRENDS: Trend[] = ['rising', 'steady', 'falling', 'unknown'];

  let open = $state(false);

  // open on a desktop, where there's room for it beside the map
  onMount(() => {
    open = matchMedia('(width >= 800px)').matches;
  });
</script>

<details class="key" bind:open>
  <summary class="carved">Key</summary>
  <fieldset>
    <legend class="visually-hidden">Show on the map</legend>
    {#each LAYERS as [layer, label] (layer)}
      <label>
        <input type="checkbox" bind:checked={shown[layer]} />
        {label}
      </label>
    {/each}
  </fieldset>
  <ul aria-label="Colours">
    {#each STATES as state (state)}
      <li><Glyph trend="steady" {state} />{stateLabel[state]}</li>
    {/each}
  </ul>
  <ul aria-label="Shapes">
    {#each TRENDS as trend (trend)}
      <li><Glyph {trend} state="unknown" />{trendLabel[trend]}</li>
    {/each}
  </ul>
</details>

<style>
  .key {
    position: absolute;
    left: var(--space-3);
    bottom: var(--space-3);
    z-index: 1;
    display: grid;
    gap: var(--space-2);
    width: min(220px, calc(100% - var(--space-6)));
    padding: var(--space-2) var(--space-3);
    font-size: 0.8125rem;
    background: color-mix(in srgb, var(--stone) 92%, transparent);
    border: 1px solid var(--incise);
    border-radius: var(--radius);
    box-shadow: 0 1px 0 var(--incise-light) inset;
    backdrop-filter: blur(6px);

    &[open] summary {
      margin-bottom: var(--space-2);
    }
  }

  summary {
    font-size: 0.75rem;
    cursor: pointer;
    min-height: 28px;
    align-content: center;
  }

  fieldset {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-1) var(--space-2);
    padding: 0 0 var(--space-2);
    border: 0;
    border-bottom: 1px solid var(--incise);
  }

  label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 28px;
    cursor: pointer;
  }

  input {
    accent-color: var(--water);
    width: 16px;
    height: 16px;
  }

  ul {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-1) var(--space-2);
    padding: var(--space-2) 0 0;
    list-style: none;
    color: var(--ink-soft);
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
</style>
