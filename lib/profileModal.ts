// Tam profil penceresinin açık olduğu kişi (profil bölüm 2). Her yerden openProfile(id) ile açılır.

import { useSyncExternalStore } from 'react';

let current: string | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function openProfile(id: string | null | undefined) {
  if (!id) return;
  current = id;
  emit();
}

export function closeProfile() {
  current = null;
  emit();
}

export function useProfileModal(): string | null {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => current,
    () => null,
  );
}
