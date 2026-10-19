<script lang="ts">
  import { ago, clock, millimetres } from '#lib/format.js';
  import { useFeed } from '#lib/live.svelte.js';
  import { name } from '#lib/meta.js';
  import type { Point } from '#lib/types.js';

  let { data } = $props();

  const HOURS = 24;
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

  // each reading is the rain in the 15 minutes before it, so they add up into hours
  const hours = $derived.by(() => {
    if (!history) return [];
    const end = Math.ceil(Date.now() / 3_600_000) * 60;
    const totals = Array.from({ length: HOURS }, (_, i) => ({ at: end - (HOURS - i) * 60, mm: 0 }));
    for (const [at, mm] of history) {
      const slot = HOURS - Math.ceil((end - at) / 60);
      if (slot >= 0 && slot < HOURS) totals[slot].mm += mm;
    }
    return totals;
  });
  const total = (since: number) =>
    (history ?? [])
      .filter(([at]) => at > Date.now() / 60_000 - since)
      .reduce((sum, [, mm]) => sum + mm, 0);
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
  <p class="kicker carved">Rain gauge</p>
  <h1>{gauge.id}</h1>
  {#if gauge.mm !== undefined && gauge.at}
    <p class="reading">
      <strong>{millimetres(gauge.mm)}</strong>
      <span>in the 15 minutes to {clock(gauge.at)} ({ago(gauge.at, feed.now)})</span>
    </p>
  {/if}
  <section>
    <h2 class="carved">Last 24 hours</h2>
    {#if history}
      <svg
        viewBox="0 0 {HOURS * 12} 80"
        role="img"
        aria-label="{millimetres(total(1440))} over the last 24 hours"
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
        <dd>{millimetres(total(60))}</dd>
        <dt>Last 24 hours</dt>
        <dd>{millimetres(total(1440))}</dd>
        <dt>Last 5 days</dt>
        <dd>{millimetres(total(7200))}</dd>
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

  .kicker {
    font-size: 0.75rem;
    color: var(--rain);
  }

  h1 {
    margin-top: calc(var(--space-3) * -1);
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
