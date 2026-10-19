<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import type { Shown } from '#lib/types.js';

  let { shown = $bindable() }: { shown: Shown } = $props();

  const LAYERS: [keyof Shown, string][] = [
    ['river', 'Rivers'],
    ['tidal', 'Tidal'],
    ['ground', 'Groundwater'],
    ['rain', 'Rain now'],
    ['warnings', 'Warnings']
  ];

  // open on a desktop, where there's room for it beside the map
  const wide = new MediaQuery('width >= 800px');
  let open = $state(false);
  $effect(() => {
    open = wide.current;
  });
</script>

<details class="layers" bind:open>
  <summary class="carved">Layers</summary>
  <fieldset>
    <legend class="visually-hidden">Show on the map</legend>
    {#each LAYERS as [layer, label] (layer)}
      <label>
        <input type="checkbox" bind:checked={shown[layer]} />
        {label}
      </label>
    {/each}
  </fieldset>
</details>

<style>
  .layers {
    position: absolute;
    inset: auto auto var(--space-3) var(--space-3);
    z-index: 1;
    max-width: calc(100% - 2 * var(--space-3));
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

  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    padding: 0;
    border: 0;

    @media (width < 800px) {
      padding-top: var(--space-2);
    }
  }

  label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 28px;
    white-space: nowrap;
    cursor: pointer;
  }

  input {
    accent-color: var(--water);
    width: 16px;
    height: 16px;
  }
</style>
