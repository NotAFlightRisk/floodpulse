<script lang="ts">
  import { goto } from '$app/navigation';
  import { kindLabel } from '#lib/format.js';
  import type { Feed } from '#lib/live.svelte.js';
  import { riverNames } from '#lib/rivers.js';
  import type { RiverName } from '#lib/types.js';

  let { feed }: { feed: Feed } = $props();

  const MOST = 8;
  const RIVERS = 3;
  let query = $state('');
  let active = $state(0);
  let open = $state(false);
  let rivers = $state.raw<RiverName[]>([]);

  // the river list only comes down once someone starts looking
  const fetchRivers = () =>
    riverNames()
      .then((list) => (rivers = list))
      .catch(() => {});

  const matches = $derived.by(() => {
    const words = query.toLowerCase().trim();
    if (words.length < 2) return [];
    const found = rivers
      .filter((river) => river.name.toLowerCase().includes(words))
      .sort((a, b) => b.gauges - a.gauges)
      .slice(0, RIVERS)
      .map((river) => ({
        href: `/river/${river.slug}`,
        title: river.name,
        meta: [
          `River, ${river.gauges} gauge${river.gauges === 1 ? '' : 's'}`,
          river.into && `into the ${river.into}`
        ]
      }));
    const gauges = (feed.live?.gauges ?? [])
      .filter((g) =>
        [g.name, g.river, g.town].some((field) => field?.toLowerCase().includes(words))
      )
      .slice(0, MOST - found.length)
      .map((g) => ({
        href: `/station/${g.id}`,
        title: g.name,
        meta: [g.river, g.town, `${kindLabel[g.kind]} gauge`]
      }));
    return [...found, ...gauges];
  });

  function pick(href: string) {
    open = false;
    query = '';
    goto(href, { reset: false });
  }

  function onkeydown(event: KeyboardEvent) {
    if (!matches.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open = true;
      active = (active + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(matches[Math.min(active, matches.length - 1)].href);
    } else if (event.key === 'Escape') {
      open = false;
    }
  }
</script>

<div class="search">
  <label class="visually-hidden" for="find">Find a river, town or gauge</label>
  <input
    id="find"
    type="search"
    role="combobox"
    autocomplete="off"
    placeholder={feed.live ? 'Find a river, town or gauge' : 'Loading the gauges...'}
    aria-expanded={open && matches.length > 0}
    aria-controls="found"
    aria-activedescendant={open && matches.length ? `found-${active}` : undefined}
    bind:value={query}
    onfocus={fetchRivers}
    oninput={() => ((open = true), (active = 0))}
    onblur={() => (open = false)}
    {onkeydown}
  />
  {#if open && matches.length}
    <ul id="found" role="listbox" aria-label="Matching rivers and gauges">
      {#each matches as match, i (match.href)}
        <li
          id="found-{i}"
          role="option"
          aria-selected={i === active}
          onpointerdown={(event) => (event.preventDefault(), pick(match.href))}
        >
          <strong>{match.title}</strong>
          <span>{match.meta.filter(Boolean).join(' · ')}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search {
    grid-column: 1 / -1;
    position: relative;
  }

  input {
    width: 100%;
    min-height: var(--tap);
    padding: 0 var(--space-3);
    background: var(--stone-sunk);
    border: 1px solid var(--incise);
    border-radius: var(--radius);

    &::placeholder {
      color: var(--ink-soft);
    }
  }

  ul {
    position: absolute;
    inset: calc(100% + var(--space-1)) 0 auto;
    z-index: 2;
    padding: var(--space-1);
    list-style: none;
    background: var(--stone);
    border: 1px solid var(--incise);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px var(--incise);
  }

  li {
    display: grid;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    cursor: pointer;

    span {
      font-size: 0.8125rem;
      color: var(--ink-soft);
    }

    &[aria-selected='true'],
    &:hover {
      background: var(--stone-sunk);
    }
  }
</style>
