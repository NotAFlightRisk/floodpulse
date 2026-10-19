<script lang="ts">
  import Glyph from '#lib/components/Glyph.svelte';
  import Hydrograph from '#lib/components/Hydrograph.svelte';
  import Pier from '#lib/components/Pier.svelte';
  import {
    ago,
    clock,
    datum,
    date,
    kindLabel,
    metres,
    signed,
    stale,
    stateLabel,
    trendLabel
  } from '#lib/format.js';
  import { useFeed } from '#lib/live.svelte.js';
  import { name, official } from '#lib/meta.js';
  import type { Point } from '#lib/types.js';

  let { data } = $props();

  const feed = useFeed();
  const gauge = $derived(feed.live?.gauges.find((g) => g.id === data.gauge.id) ?? data.gauge);
  const quiet = $derived(stale(gauge.at, feed.now));
  const place = $derived([gauge.river, gauge.town].filter(Boolean).join(', '));
  const reading = $derived(
    gauge.value === undefined
      ? 'no reading'
      : `${metres(gauge.value)}, ${stateLabel[gauge.state].toLowerCase()}`
  );

  const measure = $derived(gauge.measure);
  let history = $state.raw<Point[]>();
  let failed = $state(false);

  $effect(() => {
    const quit = new AbortController();
    history = undefined;
    failed = false;
    fetch(`/api/history/${measure}`, { signal: quit.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`history ${res.status}`))))
      .then((points: Point[]) => (history = points))
      .catch(() => !quit.signal.aborted && (failed = true));
    return () => quit.abort();
  });
</script>

<svelte:head>
  <title>{gauge.name}{place ? ` (${place})` : ''}: {reading} | {name}</title>
  <meta
    name="description"
    content="Live {kindLabel[gauge.kind].toLowerCase()} level at {gauge.name}{place
      ? `, ${place}`
      : ''}: {reading}. Five days of readings, its normal range and record high, from the Environment Agency."
  />
</svelte:head>

<article class="gauge">
  <a class="back" href="/">All rivers</a>
  <p class="kicker carved">
    {gauge.kind === 'river' ? (gauge.river ?? 'River') : kindLabel[gauge.kind]}
  </p>
  <h1>{gauge.name}</h1>
  {#if gauge.town}<p class="town">{gauge.town}</p>{/if}

  {#if gauge.value !== undefined && gauge.at}
    <p class="reading">
      <strong>{metres(gauge.value)}</strong>
      <span>{datum(gauge.unit)}, at {clock(gauge.at)} ({ago(gauge.at, feed.now)})</span>
    </p>
    {#if quiet}
      <p class="quiet">
        This gauge hasn't reported for a while, so it might be offline. Treat this as old news.
      </p>
    {/if}
    <ul class="chips">
      <li><Glyph trend="steady" state={gauge.state} />{stateLabel[gauge.state]}</li>
      <li>
        <Glyph trend={gauge.trend} state="unknown" />{trendLabel[gauge.trend]}{gauge.change !==
        undefined
          ? `, ${signed(gauge.change)} in 3 hours`
          : ''}
      </li>
    </ul>
  {:else}
    <p class="quiet">No reading from this gauge right now.</p>
  {/if}

  <Pier {gauge} />

  <section>
    <h2 class="carved">Last five days</h2>
    {#if history?.length}
      <Hydrograph points={history} {gauge} />
    {:else}
      <p class="wait">
        {failed || history
          ? "Couldn't get this gauge's history from the EA."
          : 'Fetching readings...'}
      </p>
    {/if}
  </section>

  <dl>
    {#if gauge.low !== undefined && gauge.high !== undefined}
      <dt>Normal range</dt>
      <dd>{metres(gauge.low)} to {metres(gauge.high)}</dd>
    {/if}
    {#if gauge.recent}
      <dt>Highest recent</dt>
      <dd>{metres(gauge.recent.value)} on {date(gauge.recent.date)}</dd>
    {/if}
    {#if gauge.record}
      <dt>Record high</dt>
      <dd>{metres(gauge.record.value)} on {date(gauge.record.date)}</dd>
    {/if}
    <dt>Gauge</dt>
    <dd>{gauge.id}</dd>
  </dl>

  <p class="links">
    {#if gauge.rloi}<a href="{official}/station/{gauge.rloi}">Official page for this gauge</a>{/if}
    <a href="https://environment.data.gov.uk/flood-monitoring/id/stations/{gauge.id}">Raw data</a>
  </p>
</article>

<style>
  .gauge {
    display: grid;
    gap: var(--space-4);
  }

  .back {
    justify-self: start;
    font-size: 0.875rem;
    color: var(--ink-soft);
  }

  .kicker {
    font-size: 0.75rem;
    color: var(--water);
  }

  h1 {
    margin-top: calc(var(--space-3) * -1);
    font-size: 1.75rem;
    font-weight: 750;
  }

  .town {
    margin-top: calc(var(--space-3) * -1);
    color: var(--ink-soft);
  }

  .reading {
    display: grid;

    strong {
      font-size: 2.5rem;
      font-weight: 800;
      line-height: 1.1;
      color: var(--water);
    }

    span {
      font-size: 0.875rem;
      color: var(--ink-soft);
    }
  }

  .quiet,
  .wait {
    font-size: 0.875rem;
    color: var(--ink-soft);
  }

  .quiet {
    padding-left: var(--space-3);
    border-left: 3px solid var(--ink-faint);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    list-style: none;
    padding: 0;

    li {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-3);
      font-size: 0.875rem;
      font-weight: 600;
      background: var(--stone-sunk);
      border-radius: var(--radius);
      box-shadow: inset 0 1px 2px var(--incise);
    }
  }

  section {
    display: grid;
    gap: var(--space-2);
  }

  h2 {
    font-size: 0.75rem;
    color: var(--ink-soft);
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-2) var(--space-4);
    padding-top: var(--space-4);
    font-size: 0.875rem;
    border-top: 1px solid var(--incise);
    box-shadow: inset 0 1px 0 var(--incise-light);

    dt {
      color: var(--ink-soft);
    }

    dd {
      font-weight: 600;
    }
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    font-size: 0.875rem;
  }
</style>
