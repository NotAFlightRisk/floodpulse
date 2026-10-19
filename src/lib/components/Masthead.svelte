<script lang="ts">
  import { ago } from '#lib/format.js';
  import { summarise } from '#lib/summary.js';
  import type { Feed } from '#lib/live.svelte.js';
  import type { Theme } from '#lib/theme.svelte.js';
  import type { Summary } from '#lib/types.js';
  import Search from './Search.svelte';

  let { summary, feed, theme }: { summary: Summary; feed: Feed; theme: Theme } = $props();

  const latest = $derived(feed.live ? summarise(feed.live) : summary);
  const warned = $derived(latest.warnings.length);
</script>

<div class="masthead">
  <a class="name carved" href="/" aria-label="floodpulse, back to all rivers">floodpulse</a>
  <button
    class="theme"
    onclick={() => theme.flip()}
    aria-label={theme.dark ? 'Switch to daylight' : 'Switch to night'}
  >
    <svg viewBox="0 0 20 20" aria-hidden="true">
      {#if theme.dark}
        <circle cx="10" cy="10" r="4" />
        <path
          d="M10 1.5v2.5M10 16v2.5M1.5 10H4M16 10h2.5M4 4l1.8 1.8M14.2 14.2 16 16M4 16l1.8-1.8M14.2 5.8 16 4"
        />
      {:else}
        <path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8Z" />
      {/if}
    </svg>
  </button>
  <p class="line">
    Every river gauge in England, read against its own normal.
    <span class="status" class:late={feed.failed}>
      {latest.rivers.toLocaleString('en-GB')} on rivers, {latest.high} above normal, {latest.rising} rising,
      {warned || 'no'} flood warning{warned === 1 ? '' : 's'} or alert{warned === 1 ? '' : 's'}.
      <span
        >{feed.failed ? "Can't reach us, so these are" : 'Readings'} from {ago(
          latest.fetchedAt,
          feed.now
        )}.</span
      >
    </span>
  </p>
  <Search {feed} />
</div>

<style>
  .masthead {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-5) var(--space-5) var(--space-4);

    @media (width < 800px) {
      padding: var(--space-4);
    }
  }

  .name {
    justify-self: start;
    font-size: 1.375rem;
    text-decoration: none;
    color: var(--ink);
  }

  .theme {
    display: grid;
    place-items: center;
    width: var(--tap);
    height: var(--tap);
    margin: calc(var(--space-2) * -1);
    background: none;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
    color: var(--ink-soft);

    svg {
      width: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
    }

    &:hover {
      color: var(--ink);
    }
  }

  .line {
    grid-column: 1 / -1;
    display: grid;
    gap: var(--space-1);
    font-size: 0.9375rem;
    color: var(--ink-soft);
  }

  .status {
    font-size: 0.8125rem;
    color: var(--ink-faint);

    &.late span {
      color: var(--ink);
      font-weight: 650;
    }
  }
</style>
