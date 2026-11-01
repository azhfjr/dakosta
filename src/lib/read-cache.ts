import "server-only";

type CacheEntry = {
  value: unknown;
  expiresAt: number;
  staleUntil: number;
  refreshing: boolean;
};

type CacheStore = {
  entries: Map<string, CacheEntry>;
  generation: number;
};

// Next.js can instantiate route chunks with separate copies of this module.
// Keeping the store on globalThis makes writes in an API route invalidate
// entries read by a page render in the same server process.
const globalForCache = globalThis as unknown as {
  __dakostaReadCache?: CacheStore;
};

const store: CacheStore = (globalForCache.__dakostaReadCache ??= {
  entries: new Map<string, CacheEntry>(),
  generation: 0,
});
const MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 10_000;
const DEFAULT_MAX_STALE_MS = 30_000;

function evict(now: number): void {
  const entries = store.entries;
  if (entries.size <= MAX_ENTRIES) return;
  for (const [key, entry] of entries) {
    if (entry.staleUntil <= now) entries.delete(key);
  }
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (!oldest) break;
    entries.delete(oldest);
  }
}

export function readCacheKey(
  user: { id: string; role: string; scope: unknown },
  parts: unknown,
): string {
  return JSON.stringify([user.id, user.role, user.scope, parts]);
}

/**
 * Read-through cache with stale-while-revalidate. Entries are scoped by user
 * and filters, invalidated on writes, and bounded so a local server cannot grow
 * without limit. Exports and PDFs bypass this cache entirely.
 */
export async function cachedRead<T>(
  key: string,
  load: () => Promise<T>,
  options: { ttlMs?: number; maxStaleMs?: number } = {},
): Promise<T> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxStaleMs = options.maxStaleMs ?? DEFAULT_MAX_STALE_MS;
  const now = Date.now();
  const entry = store.entries.get(key) as CacheEntry | undefined;

  if (entry && now < entry.staleUntil) {
    if (now >= entry.expiresAt && !entry.refreshing) {
      entry.refreshing = true;
      const version = store.generation;
      void load()
        .then((value) => {
          if (version !== store.generation) return;
          const refreshedAt = Date.now();
          store.entries.set(key, {
            value,
            expiresAt: refreshedAt + ttlMs,
            staleUntil: refreshedAt + ttlMs + maxStaleMs,
            refreshing: false,
          });
        })
        .catch(() => {
          entry.refreshing = false;
        });
    }
    return entry.value as T;
  }

  const version = store.generation;
  const value = await load();
  if (version === store.generation) {
    const loadedAt = Date.now();
    store.entries.set(key, {
      value,
      expiresAt: loadedAt + ttlMs,
      staleUntil: loadedAt + ttlMs + maxStaleMs,
      refreshing: false,
    });
    evict(loadedAt);
  }
  return value;
}

export function invalidateReadCacheEntry(key: string): void {
  store.entries.delete(key);
}

export function invalidateReadCache(prefix?: string): void {
  store.generation += 1;
  if (!prefix) {
    store.entries.clear();
    return;
  }
  for (const key of store.entries.keys()) {
    if (key.startsWith(prefix)) store.entries.delete(key);
  }
}

export function readCacheSize(): number {
  return store.entries.size;
}
