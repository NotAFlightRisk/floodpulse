import { error } from '@sveltejs/kit';

export async function load({ params, parent }) {
  const warning = (await parent()).summary.warnings.find((w) => w.id === params.id);
  if (!warning) error(404, "That warning isn't in force any more");
  return { warning };
}
