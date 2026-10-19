<script lang="ts">
  import 'maplibre-gl/dist/maplibre-gl.css';
  import worker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
  import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
  import type { Feature, FeatureCollection } from 'geojson';
  import type { GeoJSONSource, Map, MapLayerMouseEvent, Popup } from 'maplibre-gl';
  import { onMount, untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { goto } from '$app/navigation';
  import { metres, millimetres, severityLabel, stale } from '#lib/format.js';
  import { gauge, plaque, RATIO, SEVERITIES, STATES, TRENDS } from '#lib/map/icons.js';
  import { basemap, PAINT, palette, resolve } from '#lib/map/style.js';
  import type { Theme } from '#lib/theme.svelte.js';
  import type { Live, Picked, Shown, State } from '#lib/types.js';

  interface Props {
    live?: Live;
    picked?: Picked;
    shown: Shown;
    theme: Theme;
  }

  let { live, picked, shown, theme }: Props = $props();

  const ENGLAND: [number, number, number, number] = [-6.4, 49.9, 2.1, 55.85];
  const OUTLINES_FROM = 8;
  const calm = new MediaQuery('prefers-reduced-motion: reduce');
  const wide = new MediaQuery('width >= 800px');
  const RANK = { high: 0, low: 1, normal: 2, unknown: 3 };

  let container: HTMLDivElement;
  let map = $state.raw<Map>();
  let unsupported = $state(false);
  // the built-in Map, since maplibre's has the name in here
  const outlines = new globalThis.Map<string, Promise<Feature[]>>();

  const point = (lon: number, lat: number) => ({ type: 'Point' as const, coordinates: [lon, lat] });
  const collection = <T,>(features: T[]) => ({ type: 'FeatureCollection' as const, features });

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
            name: g.name,
            kind: g.kind,
            icon: `g-${state}-${trend}`,
            rank: RANK[state as State],
            level: g.value === undefined ? '' : metres(g.value)
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
          properties: { id: r.id, mm: r.mm!, label: `Rain gauge: ${millimetres(r.mm!)} in 15 min` }
        }))
    );

  const warnings = (data: Live) =>
    collection(
      data.warnings
        .filter((w) => w.lat !== undefined)
        .map((w) => ({
          type: 'Feature' as const,
          geometry: point(w.lon!, w.lat!),
          properties: {
            id: w.id,
            severity: w.severity,
            name: `${severityLabel[w.severity]}: ${w.label}`
          }
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
    for (const [layer, property, token] of PAINT)
      target.setPaintProperty(layer, property as never, colours[token] as never);
    const [ink, water, rainColour, ...severities] = resolve([
      'ink',
      'water',
      'rain',
      'severe',
      'warning',
      'alert'
    ]);
    target.setPaintProperty('ring', 'circle-stroke-color', ink);
    target.setPaintProperty('rain', 'circle-color', rainColour);
    target.setPaintProperty('rain', 'circle-stroke-color', water);
    const bySeverity: ExpressionSpecification = [
      'match',
      ['get', 'severity'],
      1,
      severities[0],
      2,
      severities[1],
      severities[2]
    ];
    target.setPaintProperty('outlines-fill', 'fill-color', bySeverity);
    target.setPaintProperty('outlines-line', 'line-color', bySeverity);
    paintIcons(target);
  }

  function addLayers(target: Map) {
    target.addSource('gauges', {
      type: 'geojson',
      data: collection([]),
      attribution: 'Environment Agency data (OGL)'
    });
    target.addSource('rain', { type: 'geojson', data: collection([]) });
    target.addSource('warnings', { type: 'geojson', data: collection([]) });
    target.addSource('outlines', { type: 'geojson', data: collection([]) });

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
          5,
          ['case', ['==', ['get', 'rank'], 0], 0.8, 0.55],
          9,
          ['case', ['==', ['get', 'rank'], 0], 1.2, 0.85],
          13,
          ['case', ['==', ['get', 'rank'], 0], 1.5, 1.1]
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

  function hover(
    target: Map,
    popup: Popup,
    layer: string,
    text: (props: Record<string, string>) => string
  ) {
    target.on('mousemove', layer, (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      target.getCanvas().style.cursor = 'pointer';
      const label = Object.assign(document.createElement('span'), {
        textContent: text(feature.properties)
      });
      popup.setLngLat(event.lngLat).setDOMContent(label).addTo(target);
    });
    target.on('mouseleave', layer, () => {
      target.getCanvas().style.cursor = '';
      popup.remove();
    });
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

  const go = (kind: Picked['kind']) => (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties.id;
    if (id) goto(`/${kind}/${id}`, { reset: false });
  };

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
            // room for the key strip along the bottom on a desktop
            fitBoundsOptions: {
              padding: { top: 16, right: 16, left: 16, bottom: wide.current ? 110 : 16 }
            },
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
        // compact attribution opens itself once the sources say who they are, so shut it after
        target.once('idle', () =>
          container
            .querySelector('.maplibregl-compact-show')
            ?.classList.remove('maplibregl-compact-show')
        );
        target.on('load', () => {
          addLayers(target!);
          repaint(target!);
          hover(target!, popup, 'gauges', (p) => `${p.name}${p.level ? ` · ${p.level}` : ''}`);
          hover(target!, popup, 'rain', (p) => p.label);
          hover(target!, popup, 'warnings', (p) => p.name);
          target!.on('click', 'gauges', go('station'));
          target!.on('click', 'warnings', go('warning'));
          target!.on('click', 'rain', go('rain'));
          target!.on('moveend', () => outline(target!));
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
    outline(map);
  });

  $effect(() => {
    if (!map) return;
    const kinds = (['river', 'tidal', 'ground'] as const).filter((kind) => shown[kind]);
    map.setFilter('gauges', ['in', ['get', 'kind'], ['literal', kinds]]);
    map.setLayoutProperty('rain', 'visibility', shown.rain ? 'visible' : 'none');
    for (const layer of ['warnings', 'outlines-fill', 'outlines-line'])
      map.setLayoutProperty(layer, 'visibility', shown.warnings ? 'visible' : 'none');
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
    const id = picked?.kind === 'station' ? picked.id : '';
    map.setFilter('ring', ['==', ['get', 'id'], id]);
    map.setPaintProperty(
      'gauges',
      'icon-opacity',
      id ? ['case', ['==', ['get', 'id'], id], 1, 0.35] : 1
    );
  });

  function fly(target: Map, data: Live, { kind, id }: Picked) {
    const list = kind === 'station' ? data.gauges : kind === 'rain' ? data.rain : data.warnings;
    const found = (list as { id: string; lat?: number; lon?: number }[]).find(
      (item) => item.id === id
    );
    if (found?.lat === undefined) return;
    target.flyTo({
      center: [found.lon!, found.lat],
      zoom: Math.max(target.getZoom(), kind === 'warning' ? 10 : 11),
      duration: calm.current ? 0 : 1200
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
      padding: var(--space-1) var(--space-2);
      font: 600 0.8125rem/1.3 var(--font);
      color: var(--ink);
      background: var(--stone);
      border-radius: var(--radius);
      box-shadow: 0 1px 0 var(--incise);
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
