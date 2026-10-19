<script lang="ts">
  import { clock, metres, weekday } from '#lib/format.js';
  import type { Gauge, Point } from '#lib/types.js';

  let { points, gauge }: { points: Point[]; gauge: Gauge } = $props();

  const W = 360;
  const H = 170;
  const LEFT = 40;
  const RIGHT = 8;
  const TOP = 10;
  const BOTTOM = 22;
  const DAY = 24 * 60;

  let hovered = $state<Point>();

  // zoomed to the readings, so a few centimetres of movement still shows
  const span = $derived.by(() => {
    const values = points.map(([, value]) => value);
    const middle = (Math.min(...values) + Math.max(...values)) / 2;
    const half = Math.max(((Math.max(...values) - Math.min(...values)) / 2) * 1.2, 0.05);
    return { start: points[0][0], end: points.at(-1)![0], low: middle - half, high: middle + half };
  });

  const x = (at: number) =>
    LEFT + ((at - span.start) / (span.end - span.start || 1)) * (W - LEFT - RIGHT);
  const y = (value: number) =>
    TOP + (1 - (value - span.low) / (span.high - span.low)) * (H - TOP - BOTTOM);

  const line = $derived(
    points
      .map(([at, value], i) => `${i ? 'L' : 'M'}${x(at).toFixed(1)},${y(value).toFixed(1)}`)
      .join('')
  );

  // midnight UK time, near enough, for the day labels along the bottom
  const days = $derived.by(() => {
    const marks: number[] = [];
    for (let at = Math.ceil(span.start / DAY) * DAY; at < span.end; at += DAY) marks.push(at);
    return marks;
  });

  const levels = $derived.by(() => {
    const step = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5].find(
      (size) => (span.high - span.low) / size <= 4
    )!;
    const first = Math.ceil(span.low / step) * step;
    return Array.from(
      { length: Math.floor((span.high - first) / step) + 1 },
      (_, i) => first + i * step
    );
  });

  const clamp = (value: number) => Math.min(Math.max(y(value), TOP), H - BOTTOM);

  function onpointermove(event: PointerEvent) {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const at =
      span.start +
      ((((event.clientX - box.left) / box.width) * W - LEFT) / (W - LEFT - RIGHT)) *
        (span.end - span.start);
    hovered = points.reduce((best, point) =>
      Math.abs(point[0] - at) < Math.abs(best[0] - at) ? point : best
    );
  }

  const [lowest, highest] = $derived([
    Math.min(...points.map(([, value]) => value)),
    Math.max(...points.map(([, value]) => value))
  ]);
</script>

<figure class="hydrograph">
  <svg
    viewBox="0 0 {W} {H}"
    role="img"
    aria-label="Level over the last five days, between {metres(lowest)} and {metres(highest)}"
    {onpointermove}
    onpointerleave={() => (hovered = undefined)}
  >
    {#if gauge.low !== undefined && gauge.high !== undefined}
      <rect
        class="band"
        x={LEFT}
        width={W - LEFT - RIGHT}
        y={clamp(gauge.high)}
        height={clamp(gauge.low) - clamp(gauge.high)}
      />
    {/if}
    {#each levels as level (level)}
      <line class="grid" x1={LEFT} x2={W - RIGHT} y1={y(level)} y2={y(level)} />
      <text class="axis" x={LEFT - 6} y={y(level) + 3} text-anchor="end">{level.toFixed(2)}</text>
    {/each}
    {#each days as day (day)}
      <line class="grid" x1={x(day)} x2={x(day)} y1={TOP} y2={H - BOTTOM} />
      <text class="axis" x={x(day) + 4} y={H - 6}>{weekday(day * 60_000)}</text>
    {/each}
    <path class="level" d={line} />
    <circle class="latest" cx={x(points.at(-1)![0])} cy={y(points.at(-1)![1])} r="3.5" />
    {#if hovered}
      <line class="cursor" x1={x(hovered[0])} x2={x(hovered[0])} y1={TOP} y2={H - BOTTOM} />
      <circle class="latest" cx={x(hovered[0])} cy={y(hovered[1])} r="3" />
    {/if}
  </svg>
  <figcaption>
    {#if hovered}
      {weekday(hovered[0] * 60_000)}
      {clock(hovered[0] * 60_000)}: <strong>{metres(hovered[1])}</strong>
    {:else}
      Five days, shaded where it's normal. Point at the line for a reading.
    {/if}
  </figcaption>
</figure>

<style>
  .hydrograph {
    display: grid;
    gap: var(--space-2);

    svg {
      display: block;
      width: 100%;
      touch-action: pan-y;
      font-family: var(--font);
    }
  }

  .band {
    fill: var(--water-wash);
    opacity: 0.6;
  }

  .grid {
    stroke: var(--incise);
    stroke-dasharray: 2 3;
  }

  .axis {
    font-size: 9px;
    fill: var(--ink-faint);
  }

  .level {
    fill: none;
    stroke: var(--water);
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .latest {
    fill: var(--water);
    stroke: var(--stone);
    stroke-width: 1.5;
  }

  .cursor {
    stroke: var(--ink-soft);
  }

  figcaption {
    min-height: 1.5em;
    font-size: 0.8125rem;
    color: var(--ink-soft);
  }
</style>
