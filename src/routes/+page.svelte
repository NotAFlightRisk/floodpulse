<script lang="ts">
  import { flip } from 'svelte/animate';
  import { MediaQuery } from 'svelte/reactivity';
  import Glyph from '#lib/components/Glyph.svelte';
  import Plaque from '#lib/components/Plaque.svelte';
  import RiverProfile from '#lib/components/RiverProfile.svelte';
  import { ago, metres, severityLabel, signed } from '#lib/format.js';
  import { useFeed } from '#lib/live.svelte.js';
  import { official } from '#lib/meta.js';
  import { current } from '#lib/rivers.js';
  import { summarise } from '#lib/summary.js';
  import type { River } from '#lib/types.js';

  let { data } = $props();

  const feed = useFeed();
  const calm = new MediaQuery('prefers-reduced-motion: reduce');
  const latest = $derived(feed.live ? summarise(feed.live) : data.summary);
  const lookup = $derived(new Map(feed.live?.gauges.map((g) => [g.id, g])));

  const gauges = (n: number) => `${n} gauge${n === 1 ? '' : 's'}`;

  function said({ stops, length }: River) {
    if (!feed.live) return `${gauges(stops.length)} over ${length} km`;
    const high = stops.filter((stop) => current(lookup.get(stop.id), feed.now) === 'high').length;
    if (!high) return `${gauges(stops.length)}, none above normal`;
    return stops.length === 1
      ? 'Its gauge is above normal'
      : `${high} of ${gauges(stops.length)} above normal`;
  }
</script>

<div class="overview">
  <h1 class="visually-hidden">River levels and flood warnings across England</h1>
  <section aria-labelledby="warnings">
    <h2 class="carved rule" id="warnings">Flood warnings</h2>
    {#if latest.warnings.length}
      <ul class="list">
        {#each latest.warnings as warning (warning.id)}
          <li>
            <a href="/warning/{warning.id}">
              <Plaque severity={warning.severity} />
              <span>
                <strong>{warning.label}</strong>
                <small
                  >{severityLabel[warning.severity]}{warning.county ? `, ${warning.county}` : ''},
                  since {ago(warning.changed ?? warning.raised, feed.now)}</small
                >
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="calm">
        None in force anywhere in England right now. That's the Environment Agency's word, and
        <a href={official}>Check for flooding</a> is where they'd say otherwise first.
      </p>
    {/if}
  </section>

  <section aria-labelledby="moving">
    <h2 class="carved rule" id="moving">On the move</h2>
    {#if latest.risers.length}
      <ol class="list">
        {#each latest.risers as gauge (gauge.id)}
          <li animate:flip={{ duration: calm.current ? 0 : 400 }}>
            <a href="/station/{gauge.id}">
              <Glyph trend="rising" state={gauge.state} />
              <span>
                <strong>{gauge.name}</strong>
                <small>{gauge.river ?? gauge.town ?? 'River'}, now {metres(gauge.value!)}</small>
              </span>
              <b>{signed(gauge.change!)}</b>
            </a>
          </li>
        {/each}
      </ol>
      <p class="note">Biggest rises over the last three hours.</p>
    {:else if latest.tracked}
      <p class="calm">
        Nothing's rising more than a few centimetres. The rivers are having a quiet one.
      </p>
    {:else}
      <p class="calm">Trends need three hours of readings to work out, so give it a bit.</p>
    {/if}
  </section>

  <section aria-labelledby="rivers">
    <h2 class="carved rule" id="rivers">Rivers</h2>
    <ul class="list">
      {#each data.rivers as river (river.slug)}
        <li>
          <a href="/river/{river.slug}">
            <span>
              <strong>{river.name}</strong>
              <small>{said(river)}</small>
            </span>
            {#if feed.live}
              <span class="shape"
                ><RiverProfile {river} gauges={lookup} now={feed.now} small /></span
              >
            {/if}
          </a>
        </li>
      {/each}
    </ul>
    <p class="note">The ones running highest first, then the longest. Search finds the rest.</p>
  </section>

  <section aria-labelledby="reading">
    <h2 class="carved rule" id="reading">Reading the map</h2>
    <p>
      Every river is coloured by the Environment Agency gauge watching that stretch, by where its
      level sits against that gauge's own normal range, so a deep river and a shallow brook compare
      fairly. Rivers get wider as they get bigger, and a faint one has no gauge, or no normal to go
      by. Dashes walking downstream mean it's rising.
    </p>
    <p>
      Zoom in and the gauges show up too, shaped by whether they've gone up or down over the last
      three hours. Point at a river to see its gauge, or pick one to follow it to the sea.
    </p>
    <p>
      Red and amber plaques are the EA's own flood warnings and alerts, which cover areas rather
      than gauges. A river above normal isn't a warning by itself, and no warning doesn't mean no
      risk.
    </p>
  </section>
</div>

<style>
  .overview {
    display: grid;
    gap: var(--space-6);
  }

  section {
    display: grid;
    gap: var(--space-3);
  }

  h2 {
    font-size: 0.75rem;
    color: var(--ink-soft);
  }

  p {
    font-size: 0.9375rem;
    color: var(--ink-soft);
  }

  .calm {
    color: var(--ink);
  }

  .note {
    font-size: 0.8125rem;
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

    .shape {
      flex: none;
      width: 132px;
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
