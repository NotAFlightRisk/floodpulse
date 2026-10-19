<script lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';
  import worker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
  import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
  import type { Feature } from 'geojson';
  import type { GeoJSONSource, Map, MapGeoJSONFeature, Point, Popup } from 'maplibre-gl';
  import { onMount, untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { goto } from '$app/navigation';
  import { metres, millimetres, severityLabel, stale, stateLabel } from '#lib/format.js';
  import { gauge, plaque, RATIO, SEVERITIES, STATES, TRENDS } from '#lib/map/icons.js';
  import { DASHES, FLOW, LAYER, LAYERS, opacity, ramp, SOURCE } from '#lib/map/network.js';
  import { basemap, PAINT, palette, resolve } from '#lib/map/style.js';
  import { current, position, riverNames } from '#lib/rivers.js';
  import type { Spotlight } from '#lib/spotlight.svelte.js';
  import type { Theme } from '#lib/theme.svelte.js';
  import type { Gauge, Live, Picked, River, Shown, State } from '#lib/types.js';

  interface Props {
    live?: Live;
    picked?: Picked;
    river?: River;
    shown: Shown;
    theme: Theme;
    tiles: { url: string; bounds: River['bounds'] };
    spotlight: Spotlight;
  }

  let { live, picked, river, shown, theme, tiles, spotlight }: Props = $props();

  const ENGLAND: [number, number, number, number] = [-6.4, 49.9, 2.1, 55.85];
  const OUTLINES_FROM = 8;
  const GAUGES_FROM = 8;
  const HITS = ['warnings', 'gauges', 'rain', 'network-hit'];
  const calm = new MediaQuery('prefers-reduced-motion: reduce');
  const wide = new MediaQuery('width >= 800px');
  const RANK = { high: 0, low: 1, normal: 2, unknown: 3 };

  let container: HTMLDivElement;
  let map = $state.raw<Map>();
  let unsupported = $state(false);
  // the built-in Map, since maplibre's has the name in here
  const outlines = new globalThis.Map<string, Promise<Feature[]>>();
  const byId = $derived(new globalThis.Map(live?.gauges.map((g) => [g.id, g])));
  const rising = $derived(
    live?.gauges.filter((g) => g.trend === 'rising' && !stale(g.at)).map((g) => g.id) ?? []
  );

  const point = (lon: number, lat: number) => ({ type: 'Point' as const, coordinates: [lon, lat] });
  const collection = <T,>(features: T[]) => ({ type: 'FeatureCollection' as const, features });
  const reach = (id: string) => ({ source: SOURCE, sourceLayer: LAYER, id });
  // room for the key strip along the bottom on a desktop
  const padding = (around: number) => ({
    top: around,
    right: around,
    left: around,
    bottom: wide.current ? around + 94 : around
  });

  const gauges = (data: Live) =>
    collection(
      data.gauges.map((g) => {
        // a gauge that's gone quiet gets drawn as one, whatever it said last
        const [state, trend] = stale(g.at) ? ['unknown', 'unknown'] : [g.state, g.trend];
        return {
          type: 'Feature' as const,
          geometry: point(g.lon, g.lat),
          properties: {
            id: g.id,
            kind: g.kind,
            icon: `g-${state}-${trend}`,
            rank: RANK[state as State]
          }
        };
      })
    );

  const rain = (data: Live) =>
    collection(
      data.rain
        .filter((r) => r.mm !== undefined && !stale(r.at))
        .map((r) => ({
          type: 'Feature' as const,
          geometry: point(r.lon, r.lat),
          properties: { id: r.id, mm: r.mm!, label: `${millimetres(r.mm!)} in the last 15 min` }
        }))
    );

  const warnings = (data: Live) =>
    collection(
      data.warnings
        .filter((w) => w.lat !== undefined)
        .map((w) => ({
          type: 'Feature' as const,
          geometry: point(w.lon!, w.lat!),
          properties: { id: w.id, severity: w.severity, label: w.label }
        }))
    );

  function paintIcons(target: Map) {
    const [halo, outline, ink, ...fills] = resolve([
      'map-halo',
      'ink',
      'on-plaque',
      ...STATES.map((state) => `state-${state}`),
      'severe',
      'warning',
      'alert'
    ]);
    const add = (id: string, image: ImageData) =>
      target.hasImage(id)
        ? target.updateImage(id, image)
        : target.addImage(id, image, { pixelRatio: RATIO });
    // above normal gets an ink edge, so it stands out from the stone in either theme
    STATES.forEach((state, i) =>
      TRENDS.forEach((trend) =>
        add(`g-${state}-${trend}`, gauge(trend, fills[i], state === 'high' ? outline : halo))
      )
    );
    SEVERITIES.forEach((severity) =>
      add(`w-${severity}`, plaque(severity, fills[STATES.length + severity - 1], ink))
    );
  }

  function repaint(target: Map) {
    const colours = palette();
    // maplibre types every paint property by name, which a lookup table can't promise
    const paint = (layer: string, property: string, value: unknown) =>
      target.setPaintProperty(layer, property as never, value as never);
    for (const [layer, property, token] of PAINT) paint(layer, property, colours[token]);
    const [ink, water, rainColour, label, halo, ...rest] = resolve([
      'ink',
      'water',
      'rain',
      'map-label',
      'map-halo',
      'state-low',
      'state-normal',
      'state-high',
      'map-river',
      'severe',
      'warning',
      'alert'
    ]);
    const [states, severities] = [rest.slice(0, 4), rest.slice(4)];
    paint('ring', 'circle-stroke-color', ink);
    paint('rain', 'circle-color', rainColour);
    paint('rain', 'circle-stroke-color', water);
    paint('streams', 'line-color', colours.river);
    paint('reaches', 'line-color', ramp(states));
    paint('reach-lit', 'line-color', ink);
    paint(FLOW, 'line-color', halo);
    paint('river-names', 'text-color', label);
    paint('river-names', 'text-halo-color', halo);
    const bySeverity: ExpressionSpecification = [
      'match',
      ['get', 'severity'],
      1,
      severities[0],
      2,
      severities[1],
      severities[2]
    ];
    paint('outlines-fill', 'fill-color', bySeverity);
    paint('outlines-line', 'line-color', bySeverity);
    paintIcons(target);
  }

  function addLayers(target: Map) {
    target.addSource(SOURCE, {
      type: 'vector',
      // maplibre wants a whole url, and new URL() would escape the braces
      tiles: [`${location.origin}${tiles.url}`],
      bounds: tiles.bounds,
      minzoom: 4,
      maxzoom: 10,
      promoteId: 'g',
      attribution: 'Contains OS data © Crown copyright and database right 2026'
    });
    target.addSource('gauges', {
      type: 'geojson',
      data: collection([]),
      attribution: 'Environment Agency data (OGL)'
    });
    target.addSource('rain', { type: 'geojson', data: collection([]) });
    target.addSource('warnings', { type: 'geojson', data: collection([]) });
    target.addSource('outlines', { type: 'geojson', data: collection([]) });

    for (const layer of LAYERS) target.addLayer(layer, 'places');
    target.setPaintProperty(FLOW, 'line-dasharray', DASHES[0]);
    target.addLayer({
      id: 'outlines-fill',
      type: 'fill',
      source: 'outlines',
      paint: { 'fill-opacity': 0.18 }
    });
    target.addLayer({
      id: 'outlines-line',
      type: 'line',
      source: 'outlines',
      paint: { 'line-width': 1.5 }
    });
    target.addLayer({
      id: 'rain',
      type: 'circle',
      source: 'rain',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'mm'], 0, 1.5, 0.2, 4, 1, 8, 4, 14],
        'circle-opacity': ['case', ['>', ['get', 'mm'], 0], 0.55, 0.25],
        'circle-stroke-width': ['case', ['>', ['get', 'mm'], 0], 1, 0]
      }
    });
    target.addLayer({
      id: 'gauges',
      type: 'symbol',
      source: 'gauges',
      layout: {
        'icon-image': ['get', 'icon'],
        // above normal is the one worth seeing from across the room
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          6,
          ['case', ['==', ['get', 'rank'], 0], 0.6, 0.45],
          10,
          ['case', ['==', ['get', 'rank'], 0], 0.95, 0.7],
          14,
          ['case', ['==', ['get', 'rank'], 0], 1.35, 1]
        ],
        'icon-allow-overlap': true,
        'symbol-sort-key': ['-', 3, ['get', 'rank']]
      }
    });
    target.addLayer({
      id: 'ring',
      type: 'circle',
      source: 'gauges',
      filter: ['==', ['get', 'id'], ''],
      paint: { 'circle-radius': 14, 'circle-color': 'transparent', 'circle-stroke-width': 2 }
    });
    target.addLayer({
      id: 'warnings',
      type: 'symbol',
      source: 'warnings',
      layout: {
        'icon-image': ['concat', 'w-', ['to-string', ['get', 'severity']]],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 10, 1.1],
        'icon-allow-overlap': true,
        'symbol-sort-key': ['get', 'severity']
      }
    });
  }

  const reading = (g: Gauge) =>
    g.value === undefined || stale(g.at)
      ? 'no recent reading'
      : `${metres(g.value)}, ${stateLabel[current(g)].toLowerCase()}`;

  /** A heading and a line for whatever's under the pointer */
  function describe({ layer, properties: p }: MapGeoJSONFeature): [string, string] | undefined {
    if (layer.id === 'rain') return ['Rain gauge', p.label];
    if (layer.id === 'warnings') return [p.label, severityLabel[p.severity as 1 | 2 | 3]];
    const g = byId.get(layer.id === 'gauges' ? p.id : p.g);
    if (g && layer.id === 'gauges') return [g.name, reading(g)];
    if (g) return [p.n ?? g.river ?? g.name, `${g.name} gauge: ${reading(g)}`];
    if (p.n) return [p.n, 'No gauge on this stretch'];
  }

  function tip([heading, line]: [string, string]) {
    const box = document.createElement('span');
    box.append(Object.assign(document.createElement('strong'), { textContent: heading }), line);
    return box;
  }

  /** The most useful thing under a point, with a bit of slack for fingers */
  function under(target: Map, { x, y }: Point) {
    const layers = HITS.filter((id) => target.getLayoutProperty(id, 'visibility') !== 'none');
    const found = target.queryRenderedFeatures(
      [
        [x - 6, y - 6],
        [x + 6, y + 6]
      ],
      { layers }
    );
    return HITS.map((id) => found.find((f) => f.layer.id === id)).find(Boolean);
  }

  async function open({ layer, properties: p }: MapGeoJSONFeature) {
    const kind = { gauges: 'station', warnings: 'warning', rain: 'rain' }[layer.id];
    if (kind) return goto(`/${kind}/${p.id}`, { reset: false });
    if (p.g) return goto(`/station/${p.g}`, { reset: false });
    if (p.r !== undefined) goto(`/river/${(await riverNames())[p.r].slug}`, { reset: false });
  }

  // a failed outline is forgotten, so the next pan has another go
  const fetchOutline = (id: string): Promise<Feature[]> =>
    fetch(`/api/areas/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`outline ${res.status}`))))
      .then(({ features }) => features)
      .catch(() => {
        outlines.delete(id);
        return [];
      });

  // flood area outlines are big, so each is fetched once, and only when it's in view close up
  async function outline(target: Map) {
    const data = live;
    if (!data) return;
    if (target.getZoom() >= OUTLINES_FROM) {
      const bounds = target.getBounds();
      for (const w of data.warnings)
        if (w.lat !== undefined && !outlines.has(w.id) && bounds.contains([w.lon!, w.lat]))
          outlines.set(w.id, fetchOutline(w.id));
    }
    const drawn = await Promise.all(
      data.warnings
        .filter((w) => outlines.has(w.id))
        .map(async (w) =>
          (await outlines.get(w.id)!).map((f) => ({ ...f, properties: { severity: w.severity } }))
        )
    );
    if (data === live)
      target.getSource<GeoJSONSource>('outlines')?.setData(collection(drawn.flat()));
  }

  function listen(target: Map, popup: Popup) {
    target.on('mousemove', ({ point, lngLat }) => {
      const feature = under(target, point);
      const said = feature && describe(feature);
      target.getCanvas().style.cursor = said ? 'pointer' : '';
      if (said) popup.setLngLat(lngLat).setDOMContent(tip(said)).addTo(target);
      else popup.remove();
      spotlight.id =
        feature?.properties.g ??
        (feature?.layer.id === 'gauges' ? feature.properties.id : undefined);
    });
    target.getCanvas().addEventListener('mouseleave', () => {
      popup.remove();
      spotlight.id = undefined;
    });
    target.on('click', ({ point }) => {
      const feature = under(target, point);
      if (feature) open(feature);
    });
    target.on('moveend', () => outline(target));
  }

  onMount(() => {
    let target: Map | undefined;
    let gone = false;
    import('maplibre-gl').then(
      ({ Map, Popup, NavigationControl, AttributionControl, setWorkerUrl }) => {
        if (gone) return;
        setWorkerUrl(worker);
        try {
          target = new Map({
            container,
            style: basemap(palette()),
            bounds: ENGLAND,
            fitBoundsOptions: { padding: padding(16) },
            maxBounds: [-12, 48, 6, 60],
            attributionControl: false,
            dragRotate: false,
            fadeDuration: calm.current ? 0 : 300
          });
        } catch {
          // no WebGL2, which is the browser's call rather than a bug of ours
          unsupported = true;
          return;
        }
        target.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        target.addControl(new AttributionControl({ compact: !wide.current }), 'top-right');
        const popup = new Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
          className: 'tip'
        });
        // compact attribution opens itself whenever the sources say who they are, so it gets
        // shut again until someone opens it on purpose
        const shut = () =>
          container
            .querySelector('.maplibregl-compact-show')
            ?.classList.remove('maplibregl-compact-show');
        target.on('idle', shut);
        container
          .querySelector('.maplibregl-ctrl-attrib-button')
          ?.addEventListener('click', () => target?.off('idle', shut), { once: true });
        target.on('load', () => {
          addLayers(target!);
          repaint(target!);
          listen(target!, popup);
          map = target;
        });
      }
    );
    return () => {
      gone = true;
      target?.remove();
    };
  });

  $effect(() => {
    if (!map || !live) return;
    map.getSource<GeoJSONSource>('gauges')!.setData(gauges(live));
    map.getSource<GeoJSONSource>('rain')!.setData(rain(live));
    map.getSource<GeoJSONSource>('warnings')!.setData(warnings(live));
    const now = Date.now();
    for (const g of live.gauges) map.setFeatureState(reach(g.id), { p: position(g, now) ?? null });
    outline(map);
  });

  $effect(() => {
    if (!map) return;
    const kinds = (['river', 'tidal', 'ground'] as const).filter((kind) => shown[kind]);
    const focus = river?.stops.map((stop) => stop.id) ?? [];
    // zoomed out the rivers do the talking, but boreholes have no river to colour
    map.setFilter('gauges', [
      'all',
      ['in', ['get', 'kind'], ['literal', kinds]],
      [
        'any',
        ['>=', ['zoom'], GAUGES_FROM],
        ['==', ['get', 'kind'], 'ground'],
        ['in', ['get', 'id'], ['literal', focus]]
      ]
    ]);
    map.setLayoutProperty('rain', 'visibility', shown.rain ? 'visible' : 'none');
    for (const layer of ['warnings', 'outlines-fill', 'outlines-line'])
      map.setLayoutProperty(layer, 'visibility', shown.warnings ? 'visible' : 'none');
    for (const layer of ['streams', 'reaches', 'reach-lit', FLOW, 'river-names', 'network-hit'])
      map.setLayoutProperty(layer, 'visibility', shown.river ? 'visible' : 'none');
  });

  $effect(() => {
    const pitch = shown.relief ? 55 : 0;
    if (!map || map.getPitch() === pitch) return;
    map.setTerrain(shown.relief ? { source: 'dem', exaggeration: 1.6 } : null);
    map.easeTo({ pitch, duration: calm.current ? 0 : 1400 });
  });

  $effect(() => {
    theme.dark;
    if (map) repaint(map);
  });

  $effect(() => {
    if (!map) return;
    map.setFilter(FLOW, ['in', ['get', 'g'], ['literal', rising]]);
    if (calm.current || !rising.length) return;
    const target = map;
    let frame = 0;
    let last = 0;
    let request = 0;
    const tick = (now: number) => {
      if (now - last > 70) {
        last = now;
        target.setPaintProperty(FLOW, 'line-dasharray', DASHES[frame++ % DASHES.length]);
      }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  });

  // the picked gauge and whatever's pointed at get a casing, all along their stretch
  let lit = new Set<string>();
  $effect(() => {
    if (!map) return;
    const next = new Set([picked?.kind === 'station' ? picked.id : '', spotlight.id ?? '']);
    next.delete('');
    for (const id of lit) if (!next.has(id)) map.setFeatureState(reach(id), { lit: false });
    for (const id of next) if (!lit.has(id)) map.setFeatureState(reach(id), { lit: true });
    lit = next;
  });

  $effect(() => {
    if (!map) return;
    const id = picked?.kind === 'station' ? picked.id : '';
    const keep = river?.stops.map((stop) => stop.id) ?? (id ? [id] : []);
    map.setFilter('ring', ['==', ['get', 'id'], id]);
    map.setPaintProperty(
      'gauges',
      'icon-opacity',
      keep.length ? ['case', ['in', ['get', 'id'], ['literal', keep]], 1, 0.25] : 1
    );
    for (const [layer, value] of Object.entries(opacity(river?.index)))
      map.setPaintProperty(layer, 'line-opacity', value);
  });

  function fly(target: Map, data: Live, { kind, id }: Picked) {
    const duration = calm.current ? 0 : 1200;
    if (kind === 'river' && river)
      return target.fitBounds(river.bounds, { padding: padding(40), duration });
    const list = kind === 'station' ? data.gauges : kind === 'rain' ? data.rain : data.warnings;
    const found = (list as { id: string; lat?: number; lon?: number }[]).find(
      (item) => item.id === id
    );
    if (found?.lat === undefined) return;
    target.flyTo({
      center: [found.lon!, found.lat],
      zoom: Math.max(target.getZoom(), kind === 'warning' ? 10 : 11),
      duration
    });
  }

  const ready = $derived(Boolean(map && live));

  // only when the pick changes, not every time the readings do
  $effect(() => {
    if (ready && picked) untrack(() => fly(map!, live!, picked));
  });
</script>

<div class="map" class:dark={theme.dark} bind:this={container}>
  {#if unsupported}
    <p class="unsupported">
      This browser can't draw the map, as it needs WebGL2. Search and the gauge pages still work.
    </p>
  {/if}
</div>

<style>
  .map {
    position: absolute;
    inset: 0;
    background: var(--map-land);

    .unsupported {
      display: grid;
      place-content: center;
      height: 100%;
      padding: var(--space-6);
      text-align: center;
      color: var(--ink-soft);
    }

    :global(.tip .maplibregl-popup-content) {
      display: grid;
      padding: var(--space-1) var(--space-2);
      font: 400 0.8125rem/1.35 var(--font);
      color: var(--ink-soft);
      background: var(--stone);
      border-radius: var(--radius);
      box-shadow: 0 1px 0 var(--incise);
    }

    :global(.tip strong) {
      font-weight: 650;
      color: var(--ink);
    }

    :global(.tip .maplibregl-popup-tip) {
      display: none;
    }

    :global(.maplibregl-ctrl-group),
    :global(.maplibregl-ctrl-attrib) {
      color: var(--ink-soft);
      background: var(--stone);
      box-shadow: 0 1px 0 var(--incise);
    }

    :global(.maplibregl-ctrl-attrib a) {
      color: inherit;
    }

    &.dark :global(.maplibregl-ctrl-icon) {
      filter: invert(1);
    }
  }
</style>
