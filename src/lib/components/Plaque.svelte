<script lang="ts">
  import type { Severity } from '#lib/types.js';

  let { severity }: { severity: Severity } = $props();

  const fill = $derived({ 1: 'severe', 2: 'warning', 3: 'alert' }[severity]);
</script>

<svg viewBox="0 0 24 24" aria-hidden="true" style:--fill="var(--{fill})">
  <rect x="2" y="2" width="20" height="20" rx="3" />
  {#if severity === 1}<rect class="inner" x="4.5" y="4.5" width="15" height="15" rx="2" />{/if}
  <path d="M10.75 7h2.5v7h-2.5zM10.75 15.5h2.5V18h-2.5z" />
</svg>

<style>
  svg {
    flex: none;
    width: 1.5em;
    height: 1.5em;

    rect {
      fill: var(--fill);
    }

    .inner {
      fill: none;
      stroke: var(--on-plaque);
      stroke-width: 1.5;
    }

    path {
      fill: var(--on-plaque);
    }
  }
</style>
