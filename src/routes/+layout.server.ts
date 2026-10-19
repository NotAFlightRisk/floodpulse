import { summary } from '#lib/server/data.js';

export const load = async () => ({ summary: await summary() });
