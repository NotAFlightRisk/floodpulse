import { allGauges } from '#lib/server/data.js';
import { busiest } from '#lib/server/rivers.js';

export const load = async () => ({ rivers: busiest(await allGauges()) });
