<script lang="ts">
  import { date, metres } from '#lib/format.js';
  import type { Gauge } from '#lib/types.js';

  let { gauge }: { gauge: Gauge } = $props();

  const HEIGHT = 300;
  const TOP = 14;
  const FOOT = 14;

  const marks = $derived(
    [
      gauge.record && { label: 'Record', ...gauge.record },
      gauge.recent &&
        gauge.recent.value !== gauge.record?.value && { label: 'Highest recent', ...gauge.recent }
    ].filter((mark) => !!mark)
  );

  // the pier runs from just under the lowest thing worth showing to just over the highest
  const scale = $derived.by(() => {
    const values = [gauge.value, gauge.low, gauge.high, ...marks.map((mark) => mark.value)].filter(
      (value) => value !== undefined
    );
    const low = Math.min(...values);
    const high = Math.max(...values);
    const pad = Math.max((high - low) * 0.12, 0.1);
    return { from: low - pad, to: high + pad };
  });

  const y = (value: number) =>
    TOP + (1 - (value - scale.from) / (scale.to - scale.from)) * (HEIGHT - TOP - FOOT);

  const ticks = $derived.by(() => {
    const span = scale.to - scale.from;
    const step = [0.1, 0.25, 0.5, 1, 2, 5, 10].find((size) => span / size <= 8) ?? 20;
    const first = Math.ceil(scale.from / step) * step;
    return Array.from(
      { length: Math.floor((scale.to - first) / step) + 1 },
      (_, i) => first + i * step
    );
  });
</script>

<figure class="pier">
  <svg viewBox="0 0 320 {HEIGHT}" role="img" aria-labelledby="pier-title">
    <title id="pier-title">
      {gauge.value === undefined
        ? 'No current reading'
        : `Now ${metres(gauge.value)}`}{gauge.low !== undefined
        ? `, normally ${metres(gauge.low)} to ${metres(gauge.high!)}`
        : ''}{marks
        .map((mark) => `, ${mark.label.toLowerCase()} ${metres(mark.value)} on ${date(mark.date)}`)
        .join('')}
    </title>
    <rect class="stone" x="40" y="0" width="96" height={HEIGHT} />
    {#if gauge.low !== undefined && gauge.high !== undefined}
      <rect
        class="band"
        x="40"
        y={y(gauge.high)}
        width="96"
        height={y(gauge.low) - y(gauge.high)}
      />
      <text class="note" x="88" y={(y(gauge.high) + y(gauge.low)) / 2 + 4}>NORMAL</text>
    {/if}
    {#each ticks as tick (tick)}
      <line class="tick" x1="40" x2="56" y1={y(tick)} y2={y(tick)} />
      <text class="scale" x="34" y={y(tick) + 4}>{tick.toFixed(tick % 1 ? 2 : 0)}</text>
    {/each}
    {#if gauge.value !== undefined}
      <clipPath id="pier-face"><rect x="40" y="0" width="96" height={HEIGHT} /></clipPath>
      <g clip-path="url(#pier-face)">
        <g class="water" style:--drop="{HEIGHT - y(gauge.value)}px">
          <rect x="40" y={y(gauge.value)} width="96" height={HEIGHT - y(gauge.value)} />
          <line x1="40" x2="136" y1={y(gauge.value)} y2={y(gauge.value)} />
        </g>
      </g>
      <text class="now" x="146" y={y(gauge.value) + 5}>NOW {metres(gauge.value)}</text>
    {/if}
    {#each marks as mark (mark.label)}
      <g class="mark">
        <line x1="40" x2="146" y1={y(mark.value)} y2={y(mark.value)} />
        <text x="152" y={y(mark.value) - 3}>{mark.label.toUpperCase()} {metres(mark.value)}</text>
        <text class="when" x="152" y={y(mark.value) + 11}>{date(mark.date).toUpperCase()}</text>
      </g>
    {/each}
  </svg>
</figure>

<style>
  .pier {
    svg {
      display: block;
      width: 100%;
      max-width: 360px;
      font-family: var(--font);
      font-stretch: var(--carved);
      letter-spacing: var(--tracking);
    }
  }

  .stone {
    fill: var(--stone-sunk);
    stroke: var(--incise);
  }

  .band {
    fill: var(--ground);
    stroke: var(--incise);
    stroke-dasharray: 2 3;
  }

  .note {
    text-anchor: middle;
    font-size: 9px;
    font-weight: 700;
    fill: var(--ink-faint);
  }

  .tick {
    stroke: var(--ink-faint);
  }

  .scale {
    text-anchor: end;
    font-size: 10px;
    fill: var(--ink-faint);
  }

  .water {
    animation: rise var(--slow) var(--ease-out) both;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }

    rect {
      fill: var(--water-wash);
    }

    line {
      stroke: var(--water);
      stroke-width: 3;
    }
  }

  .now {
    font-size: 13px;
    font-weight: 800;
    fill: var(--water);
  }

  .mark {
    line {
      stroke: var(--ink);
      stroke-width: 1.5;
    }

    text {
      font-size: 10px;
      font-weight: 700;
      fill: var(--ink);
    }

    .when {
      font-weight: 500;
      fill: var(--ink-soft);
    }
  }

  @keyframes rise {
    from {
      transform: translateY(var(--drop));
    }
  }
</style>
