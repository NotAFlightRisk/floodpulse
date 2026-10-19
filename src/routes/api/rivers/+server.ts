import { json } from '@sveltejs/kit';
import { riverNames } from '#lib/server/rivers.js';

export const GET = () =>
  json(riverNames(), { headers: { 'cache-control': 'public, max-age=86400' } });
