// Ctrl+K komut paleti (0.11 bölüm 1): açık / kapalı durumu ve Türkçe karaktere duyarsız arama.

import { useSyncExternalStore } from 'react';

let open = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const openPalette = () => {
  open = true;
  emit();
};
export const closePalette = () => {
  open = false;
  emit();
};
export const togglePalette = () => {
  open = !open;
  emit();
};
export function usePaletteOpen() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => open,
    () => false,
  );
}

/** "Kapı", "KAPI", "kapi" aynı: küçük harf, aksanlar ve ı/İ farkı atılır. Uzunluk değişmez (vurgulama için). */
export function fold(s: string): string {
  return Array.from(s.toLocaleLowerCase('tr'))
    .map((c) => (c === 'ı' ? 'i' : c.normalize('NFD').charAt(0)))
    .join('');
}
