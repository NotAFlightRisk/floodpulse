declare module 'cloudflare:workers' {
  export const env: {
    STORE?: {
      get(key: string): Promise<string | null>;
      put(key: string, value: string): Promise<void>;
    };
  };
  export function waitUntil(work: Promise<unknown>): void;
}
