import { env } from 'cloudflare:workers';

// KV on Cloudflare, a plain Map anywhere else
const memory = new Map<string, string>();

export const read = async (key: string) =>
  env.STORE ? await env.STORE.get(key) : (memory.get(key) ?? null);

export async function write(key: string, value: unknown) {
  const body = JSON.stringify(value);
  if (env.STORE) await env.STORE.put(key, body);
  else memory.set(key, body);
}

export async function readJson<T>(key: string) {
  const body = await read(key);
  return body ? (JSON.parse(body) as T) : undefined;
}
