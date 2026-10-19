<script lang="ts">
  import Plaque from '#lib/components/Plaque.svelte';
  import { ago, clock, date, severityLabel } from '#lib/format.js';
  import { useFeed } from '#lib/live.svelte.js';
  import { name, official } from '#lib/meta.js';

  let { data } = $props();

  const feed = useFeed();
  const warning = $derived(
    feed.live?.warnings.find((w) => w.id === data.warning.id) ?? data.warning
  );
  const since = $derived(warning.changed ?? warning.raised);
</script>

<svelte:head>
  <title>{severityLabel[warning.severity]}: {warning.label} | {name}</title>
  <meta
    name="description"
    content="{severityLabel[
      warning.severity
    ]} in force for {warning.label}, from the Environment Agency."
  />
</svelte:head>

<article class="warning">
  <a class="back" href="/">All rivers</a>
  <p class="kicker">
    <Plaque severity={warning.severity} /><span class="carved"
      >{severityLabel[warning.severity]}</span
    >
  </p>
  <h1>{warning.label}</h1>
  <p class="where">{[warning.water, warning.county, warning.area].filter(Boolean).join(' · ')}</p>
  <p class="when">In force since {clock(since)} on {date(since)} ({ago(since, feed.now)})</p>
  {#if warning.message}<p class="message">{warning.message}</p>{/if}
  <p class="links">
    <a href="{official}/target-area/{warning.id}">This warning on Check for flooding</a>
  </p>
  <p class="note">
    The outline on the map is the area this warning covers, not where the water actually is.
  </p>
</article>

<style>
  .warning {
    display: grid;
    gap: var(--space-4);
  }

  .back {
    justify-self: start;
    font-size: 0.875rem;
    color: var(--ink-soft);
  }

  .kicker {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 0.8125rem;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 750;
  }

  .where,
  .when,
  .note {
    font-size: 0.875rem;
    color: var(--ink-soft);
  }

  .message {
    white-space: pre-line;
    padding: var(--space-4);
    background: var(--stone-sunk);
    border-radius: var(--radius);
    box-shadow: inset 0 1px 2px var(--incise);
  }

  .links {
    font-weight: 600;
  }
</style>
