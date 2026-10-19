import { summary } from '#lib/server/data.js';
import { tiles } from '#lib/server/rivers.js';

export const load = async () => ({ summary: await summary(), tiles });
