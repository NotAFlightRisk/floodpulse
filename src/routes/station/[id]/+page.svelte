<script lang="ts">
  import ExternalLink from '#lib/components/ExternalLink.svelte';
  import Glyph from '#lib/components/Glyph.svelte';
  import Hydrograph from '#lib/components/Hydrograph.svelte';
  import Neighbour from '#lib/components/Neighbour.svelte';
  import Pier from '#lib/components/Pier.svelte';
  import RiverProfile from '#lib/components/RiverProfile.svelte';
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
  import { fetchHistory } from '#lib/history.js';
  import { useFeed } from '#lib/live.svelte.js';
  import { name, official } from '#lib/meta.js';
  import { neighbours } from '#lib/rivers.js';
  import type { Point } from '#lib/types.js';

  let { data } = $props();

  const feed = useFeed();
  const gauge = $derived(feed.live?.gauges.find((g) => g.id === data.gauge.id) ?? data.gauge);
  const quiet = $derived(stale(gauge.at, feed.now));
  const place = $derived([gauge.river, gauge.town].filter(Boolean).join(', '));
  const where = $derived(
    gauge.kind === 'river'
      ? place || 'River gauge'
      : [`${kindLabel[gauge.kind]} gauge`, place].filter(Boolean).join(', ')
  );
  const reading = $derived(
    gauge.value === undefined
      ? 'no reading'
      : `${metres(gauge.value)}, ${stateLabel[gauge.state].toLowerCase()}`
  );

  const lookup = $derived(new Map((feed.live?.gauges ?? data.gauges).map((g) => [g.id, g])));
  const here = $derived(data.river?.stops.find((stop) => stop.id === gauge.id));
  const near = $derived(data.river ? neighbours(data.river.stops, gauge.id) : {});

  const measure = $derived(gauge.measure);
  let history = $state.raw<Point[]>();
  let failed = $state(false);

  $effect(() => {
    const quit = new AbortController();
    history = undefined;
    failed = false;
    fetchHistory(measure, quit.signal)
      .then((points) => (history = points))
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
  <h1>{gauge.name}</h1>
  <p class="place">
    {#if data.river && gauge.river === data.river.name}
      {gauge.kind === 'river' ? '' : `${kindLabel[gauge.kind]} gauge, `}<a
        href="/river/{data.river.slug}">{gauge.river}</a
      >{gauge.town ? `, ${gauge.town}` : ''}
    {:else}
      {where}
    {/if}
  </p>

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
    <h2 class="carved rule">Last five days</h2>
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

  {#if data.river && here}
    <section>
      <h2 class="carved rule">Along the {data.river.name}</h2>
      <RiverProfile river={data.river} gauges={lookup} now={feed.now} here={gauge.id} />
      {#if near.up || near.down}
        <nav class="along" aria-label="Next gauges along the {data.river.name}">
          {#if near.up}
            <Neighbour
              stop={near.up}
              gauge={lookup.get(near.up.id)}
              way="Upriver"
              km={here.km - near.up.km}
              now={feed.now}
            />
          {/if}
          {#if near.down}
            <Neighbour
              stop={near.down}
              gauge={lookup.get(near.down.id)}
              way="Downriver"
              km={near.down.km - here.km}
              now={feed.now}
            />
          {/if}
        </nav>
      {/if}
      <a class="whole" href="/river/{data.river.slug}"
        >All {data.river.stops.length} gauges on the {data.river.name}</a
      >
    </section>
  {/if}

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
    {#if gauge.rloi}<ExternalLink href="{official}/station/{gauge.rloi}"
        >Official page for this gauge</ExternalLink
      >{/if}
    <ExternalLink href="https://environment.data.gov.uk/flood-monitoring/id/stations/{gauge.id}"
      >Raw data</ExternalLink
    >
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

  h1 {
    font-size: 1.75rem;
    font-weight: 750;
  }

  .place {
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
    padding: var(--space-2) var(--space-3);
    background: var(--stone-sunk);
    border-radius: var(--radius);
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

  .along {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);

    > :global(:only-child[rel='next']) {
      grid-column: 2;
    }
  }

  .whole {
    justify-self: start;
    font-size: 0.875rem;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-2) var(--space-4);
    padding-top: var(--space-4);
    font-size: 0.875rem;
    border-top: 1px solid var(--incise);

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
