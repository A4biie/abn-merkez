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

// Profili düzenle penceresi (bölüm 3).
let editing = false;
const editSubs = new Set<() => void>();
export function openEditor() {
  current = null;
  emit();
  editing = true;
  editSubs.forEach((f) => f());
}
export function closeEditor() {
  editing = false;
  editSubs.forEach((f) => f());
}
export function useEditorOpen(): boolean {
  return useSyncExternalStore(
    (f) => {
      editSubs.add(f);
      return () => editSubs.delete(f);
    },
    () => editing,
    () => false,
  );
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
