<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import ExternalLink from '#lib/components/ExternalLink.svelte';
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
  import { provideSpotlight, Spotlight } from '#lib/spotlight.svelte.js';
  import { Theme } from '#lib/theme.svelte.js';
  import type { Picked, Shown } from '#lib/types.js';
  import '../app.css';

  let { data, children } = $props();

  const feed = provideFeed(new Feed());
  const spotlight = provideSpotlight(new Spotlight());
  const theme = new Theme();
  let shown: Shown = $state({
    river: true,
    tidal: true,
    ground: false,
    rain: false,
    warnings: true
  });

  const KINDS = ['station', 'warning', 'rain', 'river'];
  const picked = $derived.by((): Picked | undefined => {
    const kind = page.route.id?.split('/')[1] as Picked['kind'];
    const id = page.params.id ?? page.params.slug;
    return id && KINDS.includes(kind) ? { kind, id } : undefined;
  });

  // Esc steps back out to the overview, unless someone's typing
  function onkeydown(event: KeyboardEvent) {
    const { target } = event;
    const typing =
      target instanceof Element && target.closest('input, select, textarea, [contenteditable]');
    if (event.key === 'Escape' && picked && !typing && !event.defaultPrevented) goto('/');
  }

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

<svelte:window {onkeydown} />

<div class="atlas" class:picked>
  <header class="head">
    <Masthead summary={data.summary} {feed} {theme} picked={Boolean(picked)} />
  </header>

  <section class="map" aria-label="Map of England's rivers and their gauges">
    <Map
      live={feed.live}
      {picked}
      river={page.data.river}
      {shown}
      {theme}
      tiles={data.tiles}
      {spotlight}
    />
    <Key bind:shown />
  </section>

  <div class="rail">
    <main class="panel">
      {@render children()}
    </main>

    <footer class="foot">
      <p>
        Readings from the <ExternalLink
          href="https://environment.data.gov.uk/flood-monitoring/doc/reference"
          >Environment Agency</ExternalLink
        >, under the
        <ExternalLink
          href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
          >Open Government Licence</ExternalLink
        >. Rivers from
        <ExternalLink href="https://www.ordnancesurvey.co.uk/products/os-open-rivers"
          >OS Open Rivers</ExternalLink
        >, contains OS data © Crown copyright and database right 2026. Map data ©
        <ExternalLink href="https://www.openstreetmap.org/copyright">OpenStreetMap</ExternalLink>
        contributors. Not an official service, so for anything that matters check
        <ExternalLink href={official}>Check for flooding</ExternalLink> or call Floodline on 0345 988
        1188.
      </p>
      <p>
        <ExternalLink href={source}>Source on GitHub</ExternalLink> · made by
        <ExternalLink href="https://peng.ly">NotAFlightRisk</ExternalLink>
      </p>
    </footer>
  </div>
</div>

<style>
  .atlas {
    display: grid;
    grid-template-columns: var(--slab) 1fr;
    grid-template-rows: auto 1fr;
    grid-template-areas: 'head map' 'rail map';
    height: 100dvh;

    @media (width < 800px) {
      grid-template-columns: 1fr;
      /* the map takes the rest of the first screen, with a peek of what's below */
      grid-template-rows: auto max(50svh, 100svh - 15rem) auto;
      grid-template-areas: 'head' 'map' 'rail';
      height: auto;

      &.picked {
        grid-template-rows: auto 36svh auto;
      }
    }
  }

  .head,
  .rail {
    background: var(--stone);
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

  .rail {
    grid-area: rail;
    display: grid;
    grid-template-rows: 1fr auto;
    overflow-y: auto;
    overscroll-behavior: contain;

    @media (width < 800px) {
      overflow: visible;
    }
  }

  .panel {
    padding: var(--space-5);

    @media (width < 800px) {
      padding: var(--space-5) var(--space-4);
    }
  }

  .foot {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    font-size: 0.75rem;
    color: var(--ink-soft);
    border-top: 1px solid var(--incise);

    @media (width < 800px) {
      padding: var(--space-4);
    }
  }
</style>
