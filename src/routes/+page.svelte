<script lang="ts">
  import { flip } from 'svelte/animate';
  import { MediaQuery } from 'svelte/reactivity';
  import Glyph from '#lib/components/Glyph.svelte';
  import Plaque from '#lib/components/Plaque.svelte';
  import { ago, metres, severityLabel, signed } from '#lib/format.js';
  import { useFeed } from '#lib/live.svelte.js';
  import { official } from '#lib/meta.js';
  import { summarise } from '#lib/summary.js';

  let { data } = $props();

  const feed = useFeed();
  const calm = new MediaQuery('prefers-reduced-motion: reduce');
  const latest = $derived(feed.live ? summarise(feed.live) : data.summary);
</script>

<div class="overview">
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

  <section aria-labelledby="reading">
    <h2 class="carved rule" id="reading">Reading the map</h2>
    <p>
      Every mark is an Environment Agency gauge. Its colour says where the level sits against that
      gauge's own normal range, so a deep river and a shallow brook compare fairly. Its shape says
      whether it's gone up or down over the last three hours.
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
