import { error } from '@sveltejs/kit';
import { waitUntil } from 'cloudflare:workers';
import type { Gauge, Live, River, Summary } from '#lib/types.js';
import { refresh } from './refresh.ts';
import { report } from './report.ts';
import { read, readJson } from './store.ts';

// the cron should have been by twice in this time, so it's time to go and look ourselves
const OVERDUE = 35 * 60_000;
let memo: Live | undefined;

/** The latest summary, fetching the first one ourselves if nothing has yet */
export async function summary() {
  let found = await readJson<Summary>('summary');
  if (!found) {
    await refresh();
    found = await readJson<Summary>('summary');
  } else if (Date.now() - Date.parse(found.fetchedAt) > OVERDUE) {
    waitUntil(refresh().catch((err) => report(err)));
  }
  if (!found) error(503, "The Environment Agency isn't answering right now");
  return found;
}

/** The whole snapshot as stored, so it goes out without being parsed and rebuilt */
export async function liveBody() {
  await summary();
  return read('live');
}

// each server keeps the snapshot parsed until the next one lands
async function snapshot() {
  const { fetchedAt } = await summary();
  if (memo?.fetchedAt !== fetchedAt) memo = await readJson<Live>('live');
  return memo;
}

export const findGauge = async (id: string) => (await snapshot())?.gauges.find((g) => g.id === id);
export const findRain = async (id: string) => (await snapshot())?.rain.find((r) => r.id === id);
export const allGauges = async (): Promise<Gauge[]> => (await snapshot())?.gauges ?? [];

/** The snapshot's gauges on one river, in order from its source */
export async function gaugesOn({ stops }: River) {
  const byId = new Map((await allGauges()).map((gauge) => [gauge.id, gauge]));
  return stops.flatMap(({ id }) => byId.get(id) ?? []);
}
