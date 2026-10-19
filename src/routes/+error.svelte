<script lang="ts">
  import { page } from '$app/state';

  const lost = $derived(page.status === 404);
</script>

<svelte:head>
  <title>{lost ? 'Not on the map' : 'Something went wrong'} · floodpulse</title>
</svelte:head>

<div class="lost">
  <h1>{lost ? "That's not on the map" : 'Something went wrong'}</h1>
  <p>{page.error?.message}</p>
  <a href="/">Back to all rivers</a>
</div>

<style>
  .lost {
    display: grid;
    gap: var(--space-3);
    justify-items: start;
  }

  h1 {
    font-size: 1.5rem;
  }

  p {
    color: var(--ink-soft);
  }
</style>
