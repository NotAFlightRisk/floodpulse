import { createContext } from 'svelte';
import type { Live } from './types.ts';

const EVERY = 5 * 60_000;

/** The latest snapshot, checked again every few minutes while the page is open */
export class Feed {
  live = $state.raw<Live>();
  failed = $state(false);
  now = $state(Date.now());

  async load() {
    try {
      // no-cache, or the browser sits on one answer for as long as Cloudflare says it can
      const res = await fetch('/api/live', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`/api/live answered ${res.status}`);
      this.live = await res.json();
      this.failed = false;
    } catch {
      this.failed = true;
    }
  }

  start() {
    this.load();
    const timers = [
      setInterval(() => this.load(), EVERY),
      setInterval(() => (this.now = Date.now()), 30_000)
    ];
    return () => timers.forEach(clearInterval);
  }
}

export const [useFeed, provideFeed] = createContext<Feed>();
