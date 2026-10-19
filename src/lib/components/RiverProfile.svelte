<script lang="ts">
  import { goto } from '$app/navigation';
  import { metres, stateLabel } from '#lib/format.js';
  import { current, position } from '#lib/rivers.js';
  import { useSpotlight } from '#lib/spotlight.svelte.js';
  import type { Gauge, River } from '#lib/types.js';

  interface Props {
    river: River;
    gauges: Map<string, Gauge>;
    now: number;
    here?: string;
    small?: boolean;
  }

  let { river, gauges, now, here, small = false }: Props = $props();

  const spotlight = useSpotlight();
  const W = $derived(small ? 132 : 360);
  const H = $derived(small ? 44 : 168);
  const LEFT = $derived(small ? 4 : 72);
  const RIGHT = $derived(small ? 4 : 10);
  const TOP = $derived(small ? 6 : 12);
  // the river itself runs along the bottom, with every gauge ticked on it
  const TRACK = $derived(H - (small ? 6 : 26));
  const PLOT = $derived(TRACK - (small ? 6 : 14));
  // how far past either edge of normal there's room to show, in widths of the normal range
  const [FLOOR, CEILING] = [-0.75, 1.75];

  const x = (km: number) => LEFT + (km / river.length) * (W - LEFT - RIGHT);
  const y = (p: number) =>
    TOP + ((CEILING - Math.min(Math.max(p, FLOOR), CEILING)) / (CEILING - FLOOR)) * (PLOT - TOP);

  const points = $derived(
    river.stops.map((stop) => {
      const gauge = gauges.get(stop.id);
      return { ...stop, gauge, p: gauge && position(gauge, now), state: current(gauge, now) };
    })
  );
  const read = $derived(points.filter((point) => point.p !== undefined));
  const counts = $derived(
    (['high', 'normal', 'low'] as const)
      .map((state) => [state, points.filter((point) => point.state === state).length] as const)
      .filter(([, count]) => count)
  );
  const summary = $derived(
    `${river.name} from source to ${river.into ? `the ${river.into.name}` : river.sea ? 'the sea' : 'its end'}, ${river.length} km with ${points.length} gauge${points.length === 1 ? '' : 's'}${counts.length ? `: ${counts.map(([state, count]) => `${count} ${stateLabel[state].toLowerCase()}`).join(', ')}` : ''}`
  );

  let hovered = $state<(typeof points)[number]>();
  const shown = $derived(hovered ?? points.find((point) => point.id === spotlight.id));

  function nearest(event: MouseEvent) {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const km =
      ((((event.clientX - box.left) / box.width) * W - LEFT) / (W - LEFT - RIGHT)) * river.length;
    return points.reduce((best, point) =>
      Math.abs(point.km - km) < Math.abs(best.km - km) ? point : best
    );
  }

  function onpointermove(event: PointerEvent) {
    hovered = nearest(event);
    spotlight.id = hovered.id;
  }

  function onpointerleave() {
    hovered = undefined;
    spotlight.id = undefined;
  }
</script>

<figure class="profile" class:small>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <svg
    viewBox="0 0 {W} {H}"
    role="img"
    aria-label={summary}
    onpointermove={small ? undefined : onpointermove}
    onpointerleave={small ? undefined : onpointerleave}
    onclick={small ? undefined : (event) => goto(`/station/${nearest(event).id}`, { reset: false })}
  >
    <rect class="band" x={LEFT} width={W - LEFT - RIGHT} y={y(1)} height={y(0) - y(1)} />
    {#if !small}
      <text class="scale" x={LEFT - 8} y={y(1.4) + 3}>ABOVE</text>
      <text class="scale" x={LEFT - 8} y={y(0.5) + 3}>NORMAL</text>
      <text class="scale" x={LEFT - 8} y={y(-0.4) + 3}>BELOW</text>
    {/if}
    <line class="river" x1={LEFT} x2={W - RIGHT} y1={TRACK} y2={TRACK} />
    {#each points as point (point.id)}
      <line class="tick" x1={x(point.km)} x2={x(point.km)} y1={TRACK - 3} y2={TRACK + 3} />
    {/each}
    {#if shown && !small}
      <line class="cursor" x1={x(shown.km)} x2={x(shown.km)} y1={TOP} y2={TRACK} />
    {/if}
    {#each read as point (point.id)}
      <circle
        class="dot"
        class:here={point.id === here}
        cx={x(point.km)}
        cy={y(point.p!)}
        r={point.id === here ? 5.5 : small ? 2.5 : 3.5}
        style:--fill="var(--state-{point.state})"
      />
    {/each}
    {#if !small}
      <text class="end" x={LEFT} y={H - 6}>SOURCE</text>
      <text class="end" x={W - RIGHT} y={H - 6} text-anchor="end">
        {river.into
          ? `INTO THE ${river.into.name.replace(/^River /, '').toUpperCase()}`
          : river.sea
            ? 'SEA'
            : 'END'}
      </text>
    {/if}
  </svg>
  {#if !small}
    <figcaption>
      {#if shown?.gauge}
        <strong>{shown.gauge.name}</strong>
        {shown.gauge.value === undefined ? 'no reading' : metres(shown.gauge.value)}, {stateLabel[
          shown.state
        ].toLowerCase()}, {shown.km} km from the source
      {:else}
        Each dot is a gauge, as high as its river is running against its own normal. Point at one to
        see it.
      {/if}
    </figcaption>
  {/if}
</figure>

<style>
  .profile {
    display: grid;
    gap: var(--space-2);

    svg {
      display: block;
      width: 100%;
      font-family: var(--font);
      font-stretch: var(--carved);
      letter-spacing: var(--tracking);
      touch-action: pan-y;
      cursor: pointer;
    }

    &.small svg {
      cursor: inherit;
    }
  }

  .band {
    fill: var(--band);
  }

  .scale,
  .end {
    font-size: 10px;
    font-weight: 700;
    fill: var(--ink-faint);
  }

  .scale {
    text-anchor: end;
  }

  .river {
    stroke: var(--water);
    stroke-width: 3;
    stroke-linecap: round;

    .small & {
      stroke-width: 2;
    }
  }

  .tick {
    stroke: var(--stone);
    stroke-width: 1.5;
  }

  .cursor {
    stroke: var(--ink-soft);
  }

  .dot {
    fill: var(--fill);
    stroke: var(--stone);
    stroke-width: 1.5;

    &.here {
      stroke: var(--ink);
      stroke-width: 2;
    }
  }

  figcaption {
    min-height: 3em;
    font-size: 0.8125rem;
    color: var(--ink-soft);

    strong {
      color: var(--ink);
    }
  }
</style>
