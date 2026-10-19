<script lang="ts">
  import Glyph from '#lib/components/Glyph.svelte';
  import RiverProfile from '#lib/components/RiverProfile.svelte';
  import { metres, stale, stateLabel } from '#lib/format.js';
  import { useFeed } from '#lib/live.svelte.js';
  import { name } from '#lib/meta.js';
  import { current } from '#lib/rivers.js';
  import { useSpotlight } from '#lib/spotlight.svelte.js';
  import type { State } from '#lib/types.js';

  let { data } = $props();

  const feed = useFeed();
  const spotlight = useSpotlight();
  const river = $derived(data.river);
  const lookup = $derived(new Map((feed.live?.gauges ?? data.gauges).map((g) => [g.id, g])));
  const along = $derived(
    river.stops.flatMap((stop) => {
      const gauge = lookup.get(stop.id);
      return gauge ? [{ ...stop, gauge, state: current(gauge, feed.now) }] : [];
    })
  );
  const count = (state: State) => along.filter((stop) => stop.state === state).length;
  const rising = $derived(
    along.filter(({ gauge }) => gauge.trend === 'rising' && !stale(gauge.at, feed.now)).length
  );
  const chips = $derived(
    [
      ['high', count('high'), 'above normal'],
      ['normal', count('normal'), 'normal'],
      ['low', count('low'), 'below normal']
    ].filter(([, n]) => n) as [State, number, string][]
  );
  const mouth = $derived(
    river.into ? `the ${river.into.name}` : river.sea ? 'the sea' : 'where it ends'
  );
</script>

<svelte:head>
  <title>{river.name}: levels at {river.stops.length} gauges | {name}</title>
  <meta
    name="description"
    content="Live levels along the {river.name}, from its source to {mouth}: {river.stops
      .length} Environment Agency gauges, each read against its own normal range."
  />
</svelte:head>

<article class="river">
  <a class="back" href="/">All rivers</a>
  <h1>{river.name}</h1>
  <p class="place">
    {river.length} km from its source to
    {#if river.into}
      the <a href="/river/{river.into.slug}">{river.into.name}</a>
    {:else}
      {mouth}
    {/if}
  </p>

  <ul class="chips">
    {#each chips as [state, n, label] (state)}
      <li><Glyph trend="steady" {state} />{n} {label}</li>
    {/each}
    {#if rising}
      <li><Glyph trend="rising" state="unknown" />{rising} rising</li>
    {/if}
  </ul>

  <RiverProfile {river} gauges={lookup} now={feed.now} />

  <section aria-labelledby="gauges">
    <h2 class="carved rule" id="gauges">Gauges, source to {river.sea ? 'sea' : 'end'}</h2>
    <ol class="list">
      {#each along as stop (stop.id)}
        <li>
          <a
            href="/station/{stop.id}"
            onpointerenter={() => (spotlight.id = stop.id)}
            onpointerleave={() => (spotlight.id = undefined)}
            onfocus={() => (spotlight.id = stop.id)}
            onblur={() => (spotlight.id = undefined)}
          >
            <Glyph
              trend={stop.state === 'unknown' ? 'unknown' : stop.gauge.trend}
              state={stop.state}
            />
            <span>
              <strong>{stop.gauge.name}</strong>
              <small>{stop.km} km · {stateLabel[stop.state]}</small>
            </span>
            <b>{stop.gauge.value === undefined ? '' : metres(stop.gauge.value)}</b>
          </a>
        </li>
      {/each}
    </ol>
  </section>
</article>

<style>
  .river {
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
    gap: var(--space-3);
  }

  h2 {
    font-size: 0.75rem;
    color: var(--ink-soft);
  }

  .list {
    display: grid;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--incise);

    li {
      border-bottom: 1px solid var(--incise);
    }

    a {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: var(--tap);
      padding: var(--space-2) 0;
      text-decoration: none;

      &:hover strong {
        text-decoration: underline;
      }
    }

    span {
      display: grid;
      flex: 1;
      min-width: 0;
    }

    small {
      font-size: 0.8125rem;
      color: var(--ink-soft);
    }

    b {
      font-weight: 750;
      color: var(--water);
    }
  }
</style>
