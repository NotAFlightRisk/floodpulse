<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import Key from '#lib/components/Key.svelte';
  import Map from '#lib/components/Map.svelte';
  import Masthead from '#lib/components/Masthead.svelte';
  import { Feed, provideFeed } from '#lib/live.svelte.js';
  import {
    description,
    imageAlt,
    name,
    official,
    site,
    source,
    structuredData,
    title
  } from '#lib/meta.js';
  import { loadPlausible } from '#lib/plausible.js';
  import { Theme } from '#lib/theme.svelte.js';
  import type { Picked, Shown } from '#lib/types.js';
  import '../app.css';

  let { data, children } = $props();

  const feed = provideFeed(new Feed());
  const theme = new Theme();
  let shown: Shown = $state({
    river: true,
    tidal: true,
    ground: false,
    rain: false,
    warnings: true,
    relief: false
  });

  const picked = $derived.by((): Picked | undefined => {
    const kind = page.route.id?.split('/')[1];
    return page.params.id && (kind === 'station' || kind === 'warning' || kind === 'rain')
      ? { kind, id: page.params.id }
      : undefined;
  });

  onMount(() => {
    loadPlausible();
    return feed.start();
  });
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={`${site}${page.url.pathname}`} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={name} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={`${site}${page.url.pathname}`} />
  <meta property="og:image" content={`${site}/og.png`} />
  <meta property="og:image:alt" content={imageAlt} />
  <meta name="twitter:card" content="summary_large_image" />
  {@html `<script type="application/ld+json">${structuredData}</script>`}
</svelte:head>

<div class="atlas">
  <header class="head">
    <Masthead summary={data.summary} {feed} {theme} />
  </header>

  <div class="map">
    <Map live={feed.live} {picked} {shown} {theme} />
    <Key bind:shown />
  </div>

  <main class="panel">
    {@render children()}
  </main>

  <footer class="foot">
    <p>
      Readings from the <a href="https://environment.data.gov.uk/flood-monitoring/doc/reference"
        >Environment Agency</a
      >, under the
      <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
        >Open Government Licence</a
      >. Not an official service, so for anything that matters check
      <a href={official}>Check for flooding</a> or call Floodline on 0345 988 1188.
    </p>
    <p>
      <a href={source}>Source on GitHub</a> · made by <a href="https://peng.ly">NotAFlightRisk</a>
    </p>
  </footer>
</div>

<style>
  .atlas {
    display: grid;
    grid-template-columns: var(--slab) 1fr;
    grid-template-rows: auto 1fr auto;
    grid-template-areas: 'head map' 'panel map' 'foot map';
    height: 100dvh;

    @media (width < 800px) {
      grid-template-columns: 1fr;
      grid-template-rows: auto 58svh auto auto;
      grid-template-areas: 'head' 'map' 'panel' 'foot';
      height: auto;
    }
  }

  .head,
  .panel,
  .foot {
    background: var(--grain), var(--stone);
    border-right: 1px solid var(--incise);
  }

  .head {
    grid-area: head;
    border-bottom: 1px solid var(--incise);
  }

  .map {
    grid-area: map;
    position: relative;
    isolation: isolate;
  }

  .panel {
    grid-area: panel;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--space-5);

    @media (width < 800px) {
      overflow: visible;
      padding: var(--space-5) var(--space-4);
    }
  }

  .foot {
    grid-area: foot;
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    font-size: 0.75rem;
    color: var(--ink-soft);
    border-top: 1px solid var(--incise);
    box-shadow: inset 0 1px 0 var(--incise-light);

    @media (width < 800px) {
      padding: var(--space-4);
    }
  }
</style>
