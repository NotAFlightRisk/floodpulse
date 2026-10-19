<script lang="ts">
  import { trendLabel } from '#lib/format.js';
  import type { Trend } from '#lib/types.js';
  import Glyph from './Glyph.svelte';

  const LINES = [
    ['high', 'Above normal'],
    ['normal', 'Normal'],
    ['low', 'Below normal'],
    ['faint', 'No gauge or range'],
    ['rising', 'Rising']
  ];
  const TRENDS: Trend[] = ['rising', 'steady', 'falling', 'unknown'];
</script>

<ul aria-label="River colours">
  {#each LINES as [kind, label] (kind)}
    <li>
      <svg class="line {kind}" viewBox="0 0 20 8" aria-hidden="true">
        <path d="M2 4h16" />
        {#if kind === 'rising'}<path class="dashes" d="M2 4h16" />{/if}
      </svg>
      {label}
    </li>
  {/each}
</ul>

<details>
  <summary>More detail</summary>
  <div class="more">
    <p>
      Each river is coloured by the Environment Agency gauge on that stretch, against its own normal
      range, so a deep river and a shallow brook compare fairly.
    </p>
    <p>Zoom in and the gauges show up, shaped by how they've moved over the last three hours.</p>
    <ul aria-label="Gauge shapes">
      {#each TRENDS as trend (trend)}
        <li><Glyph {trend} state="unknown" />{trendLabel[trend]}</li>
      {/each}
    </ul>
    <p>
      Red and amber plaques are the EA's flood warnings and alerts, which cover areas rather than
      gauges. A river above normal isn't a warning by itself, and no warning doesn't mean no risk.
    </p>
  </div>
</details>

<style>
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-4);
    padding: 0;
    font-size: 0.8125rem;
    color: var(--ink-soft);
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 28px;
    white-space: nowrap;
  }

  .line {
    flex: none;
    width: 20px;
    height: 8px;
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;

    &.high {
      stroke: var(--state-high);
    }

    &.normal,
    &.rising {
      stroke: var(--state-normal);
    }

    &.low {
      stroke: var(--state-low);
    }

    &.faint {
      stroke: var(--map-river);
      opacity: 0.5;
    }

    .dashes {
      stroke: var(--map-halo);
      stroke-width: 1.5;
      stroke-linecap: butt;
      stroke-dasharray: 3 3;
    }
  }

  /* slides open where the browser can animate to auto, and just opens elsewhere */
  details {
    interpolate-size: allow-keywords;

    &::details-content {
      height: 0;
      overflow: clip;
      transition:
        height 300ms var(--ease-out),
        content-visibility 300ms allow-discrete;
    }

    &[open]::details-content {
      height: auto;
    }

    @media (prefers-reduced-motion: reduce) {
      &::details-content {
        transition: none;
      }
    }
  }

  summary {
    min-height: 28px;
    align-content: center;
    font-size: 0.8125rem;
    color: var(--ink-soft);
    cursor: pointer;

    &:hover {
      color: var(--ink);
    }
  }

  .more {
    display: grid;
    gap: var(--space-3);
    padding-top: var(--space-2);
  }

  p {
    font-size: 0.9375rem;
    color: var(--ink-soft);
  }
</style>
