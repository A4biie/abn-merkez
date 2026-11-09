// "Görev bitti" kutlaması için az önce bitirilen görevler. Liste bitmiş görevleri gizlese de
// kart birkaç saniye yerinde kalır ki kutlama görünsün.

import { useSyncExternalStore } from 'react';

const SHOW_MS = 6000;
const finished = new Map<string, number>();
const listeners = new Set<() => void>();
let snapshot: ReadonlySet<string> = new Set();

function emit() {
  snapshot = new Set(finished.keys());
  listeners.forEach((l) => l());
}

export function markFinished(taskId: string) {
  finished.set(taskId, Date.now());
  emit();
  setTimeout(() => {
    finished.delete(taskId);
    emit();
  }, SHOW_MS);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Son birkaç saniyede bitirilen görevlerin kimlikleri. */
export function useJustFinished(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
