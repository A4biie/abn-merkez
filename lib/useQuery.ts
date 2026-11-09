import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { friendlyError } from './errors';

// Küçük bir önbellek: aynı anahtarı kullanan ekranlar aynı veriyi paylaşır, bir değişiklikten
// sonra invalidate('tasks') dendiğinde o anahtarı dinleyen her ekran kendini yeniler.

type Entry = { data?: unknown; error?: string; loading: boolean; promise?: Promise<void> };

const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

function subscribe(key: string, fn: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(fn);
  return () => set.delete(fn);
}

async function run<T>(key: string, fetcher: () => Promise<T>) {
  const prev = cache.get(key);
  if (prev?.promise) return prev.promise;
  const entry: Entry = { ...prev, loading: true };
  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, loading: false });
    })
    .catch((e) => {
      cache.set(key, { data: prev?.data, error: friendlyError(e), loading: false });
    })
    .finally(() => emit(key));
  entry.promise = promise;
  cache.set(key, entry);
  emit(key);
  return promise;
}

/** Değişiklikten sonra bu anahtarlarla başlayan sorguları yeniden çeker. */
export function invalidate(...prefixes: string[]) {
  for (const key of listeners.keys()) {
    if (prefixes.some((p) => key === p || key.startsWith(p + ':'))) {
      const entry = cache.get(key);
      if (entry) cache.set(key, { ...entry, promise: undefined });
      refetchers.get(key)?.();
    }
  }
}

const refetchers = new Map<string, () => void>();

/** İyimser güncelleme: sunucuya gitmeden önce önbellekteki veriyi değiştirir. */
export function mutateCache<T>(key: string, update: (prev: T | undefined) => T) {
  const entry = cache.get(key) ?? { loading: false };
  cache.set(key, { ...entry, data: update(entry.data as T | undefined) });
  emit(key);
}

/** Önbellekteki son veri (yenilemeden hemen sonra okumak için). */
export function readCache<T>(key: string) {
  return cache.get(key)?.data as T | undefined;
}

export type QueryState<T> = {
  data: T | undefined;
  error: string | undefined;
  /** İlk yükleme sürüyor ve elde veri yok: iskelet gösterilir. */
  loading: boolean;
  refetch: () => Promise<void>;
};

export function useQuery<T>(key: string | null, fetcher: () => Promise<T>): QueryState<T> {
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const entry = useSyncExternalStore(
    useCallback((fn) => (key ? subscribe(key, fn) : () => {}), [key]),
    () => (key ? cache.get(key) : undefined),
    () => (key ? cache.get(key) : undefined),
  );

  const refetch = useCallback(async () => {
    if (!key) return;
    const e = cache.get(key);
    if (e) cache.set(key, { ...e, promise: undefined });
    await run(key, () => fetcherRef.current());
  }, [key]);

  useEffect(() => {
    if (!key) return;
    refetchers.set(key, () => {
      run(key, () => fetcherRef.current());
    });
    if (!cache.get(key)?.data && !cache.get(key)?.promise) run(key, () => fetcherRef.current());
    return () => {
      if (!listeners.get(key)?.size) refetchers.delete(key);
    };
  }, [key]);

  return {
    data: entry?.data as T | undefined,
    error: entry?.error,
    loading: !!key && entry?.data === undefined && !entry?.error,
    refetch,
  };
}

/** Çıkış yapınca bir önceki kişinin verisi kalmasın. */
export function clearQueryCache() {
  cache.clear();
  for (const key of listeners.keys()) emit(key);
}
