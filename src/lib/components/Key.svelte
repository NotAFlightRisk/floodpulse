<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import { trendLabel } from '#lib/format.js';
  import type { Shown, Trend } from '#lib/types.js';
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
  const LINES = [
    ['high', 'Above normal'],
    ['normal', 'Normal'],
    ['low', 'Below normal'],
    ['faint', 'No gauge or range'],
    ['rising', 'Rising']
  ];
  const TRENDS: Trend[] = ['rising', 'steady', 'falling', 'unknown'];

  // open on a desktop, where there's room for it beside the map
  const wide = new MediaQuery('width >= 800px');
  let open = $state(false);
  $effect(() => {
    open = wide.current;
  });
</script>

<details class="key" bind:open>
  <summary class="carved">Key</summary>
  <div class="groups">
    <fieldset>
      <legend class="visually-hidden">Show on the map</legend>
      {#each LAYERS as [layer, label] (layer)}
        <label>
          <input type="checkbox" bind:checked={shown[layer]} />
          {label}
        </label>
      {/each}
    </fieldset>
    <ul aria-label="River colours">
      <li class="carved" aria-hidden="true">Rivers</li>
      {#each LINES as [kind, label] (kind)}
        <li>
          <svg class="line {kind}" viewBox="0 0 20 8" aria-hidden="true">
            <path d="M2 4h16" />
            {#if kind === 'rising'}<path class="dashes" d="M2 4h16" />{/if}
          </svg>
          {label}
        </li>
      {/each}
    </ul>
    <ul aria-label="Gauge shapes">
      <li class="carved" aria-hidden="true">Gauges</li>
      {#each TRENDS as trend (trend)}
        <li><Glyph {trend} state="unknown" />{trendLabel[trend]}</li>
      {/each}
    </ul>
  </div>
</details>

<style>
  .key {
    position: absolute;
    inset: auto var(--space-3) var(--space-3);
    z-index: 1;
    padding: var(--space-2) var(--space-3);
    font-size: 0.8125rem;
    background: var(--stone);
    border: 1px solid var(--incise);
    border-radius: var(--radius);

    @media (width < 800px) {
      inset: var(--space-3) auto auto var(--space-3);
      max-width: calc(100% - 72px);
    }
  }

  summary {
    min-height: 28px;
    align-content: center;
    font-size: 0.75rem;
    cursor: pointer;

    /* there's room for the whole strip on a desktop, so it stays put */
    @media (width >= 800px) {
      display: none;
    }
  }

  .groups {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);

    @media (width < 800px) {
      display: grid;
      gap: var(--space-2);
      padding-top: var(--space-2);
    }
  }

  fieldset,
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    padding: 0;
    border: 0;
    list-style: none;
  }

  ul {
    color: var(--ink-soft);

    @media (width >= 800px) {
      padding-left: var(--space-4);
      border-left: 1px solid var(--incise);
    }
  }

  label,
  li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 28px;
    white-space: nowrap;
  }

  label {
    cursor: pointer;
  }

  li.carved {
    font-size: 0.75rem;
    color: var(--ink-soft);
  }

  .line {
    flex: none;
    width: 20px;
    height: 8px;
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;

    &.high {
      stroke: var(--state-high);
    }

    &.normal,
    &.rising {
      stroke: var(--state-normal);
    }

    &.low {
      stroke: var(--state-low);
    }

    &.faint {
      stroke: var(--map-river);
      opacity: 0.5;
    }

    .dashes {
      stroke: var(--map-halo);
      stroke-width: 1.5;
      stroke-linecap: butt;
      stroke-dasharray: 3 3;
    }
  }

  input {
    accent-color: var(--water);
    width: 16px;
    height: 16px;
  }
</style>
