<script lang="ts">
  import { ago, clock, millimetres } from '#lib/format.js';
  import { useFeed } from '#lib/live.svelte.js';
  import { name } from '#lib/meta.js';
  import { hourly, total } from '#lib/rain.js';
  import type { Point } from '#lib/types.js';

  let { data } = $props();

  const feed = useFeed();
  const gauge = $derived(feed.live?.rain.find((r) => r.id === data.gauge.id) ?? data.gauge);
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

  const hours = $derived(history ? hourly(history, feed.now) : []);
  const sum = (minutes: number) => total(history ?? [], feed.now, minutes);
  const tallest = $derived(Math.max(1, ...hours.map((hour) => hour.mm)));
</script>

<svelte:head>
  <title>Rain gauge {gauge.id} | {name}</title>
  <meta
    name="description"
    content="Live rainfall at Environment Agency rain gauge {gauge.id}, hour by hour over the last day."
  />
</svelte:head>

<article class="rain">
  <a class="back" href="/">All rivers</a>
  <h1>Rain gauge {gauge.id}</h1>
  {#if gauge.mm !== undefined && gauge.at}
    <p class="reading">
      <strong>{millimetres(gauge.mm)}</strong>
      <span>in the 15 minutes to {clock(gauge.at)} ({ago(gauge.at, feed.now)})</span>
    </p>
  {/if}
  <section>
    <h2 class="carved rule">Last 24 hours</h2>
    {#if history}
      <svg
        viewBox="0 0 {hours.length * 12} 80"
        role="img"
        aria-label="{millimetres(sum(1440))} over the last 24 hours"
      >
        {#each hours as hour, i (hour.at)}
          <rect
            x={i * 12 + 1}
            width="10"
            y={78 - (hour.mm / tallest) * 74}
            height={Math.max((hour.mm / tallest) * 74, 1)}
          />
        {/each}
      </svg>
      <dl>
        <dt>Last hour</dt>
        <dd>{millimetres(sum(60))}</dd>
        <dt>Last 24 hours</dt>
        <dd>{millimetres(sum(1440))}</dd>
        <dt>Last 5 days</dt>
        <dd>{millimetres(sum(7200))}</dd>
      </dl>
      <p class="note">Missing readings count as nothing, so these are the least it rained.</p>
    {:else}
      <p class="note">
        {failed ? "Couldn't get this gauge's history from the EA." : 'Fetching readings...'}
      </p>
    {/if}
  </section>
</article>

<style>
  .rain {
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

  .reading {
    display: grid;

    strong {
      font-size: 2.5rem;
      font-weight: 800;
      line-height: 1.1;
      color: var(--rain);
    }

    span {
      font-size: 0.875rem;
      color: var(--ink-soft);
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

  svg {
    width: 100%;

    rect {
      fill: var(--rain);
    }
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-2) var(--space-4);
    font-size: 0.875rem;

    dt {
      color: var(--ink-soft);
    }

    dd {
      font-weight: 600;
    }
  }

  .note {
    font-size: 0.8125rem;
    color: var(--ink-soft);
  }
</style>
