/**
 * Simple in-memory client-side cache with stale-while-revalidate semantics.
 * Data is served instantly from cache and refreshed in the background.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Max age before data is considered stale (30 seconds) */
const STALE_MS = 30_000;

export function cacheGet<T>(key: string): { data: T; stale: boolean } | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  const stale = Date.now() - entry.timestamp > STALE_MS;
  return { data: entry.data, stale };
}

export function cacheSet<T>(key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now() });
}

export function cacheInvalidate(key: string): void {
  store.delete(key);
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
