import type { Point } from './types.ts';

/** A gauge's last five days, revalidated, as Cloudflare would let the browser keep it for hours */
export const fetchHistory = (measure: string, signal: AbortSignal): Promise<Point[]> =>
  fetch(`/api/history/${measure}`, { cache: 'no-cache', signal }).then((res) =>
    res.ok ? res.json() : Promise.reject(new Error(`history ${res.status}`))
  );
