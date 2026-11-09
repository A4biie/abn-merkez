// Bildirim ayarları (masaüstü). localStorage'da durur; launcher, Merkez ve bildirim penceresi aynı
// kaynağı paylaştığı için bir pencerede değişen ayar "storage" olayıyla diğerlerine de geçer.

import { useEffect, useState } from 'react';

export type NotifyTypeKey = 'mesaj' | 'anma' | 'kalp' | 'gorev' | 'duyuru' | 'oylama';
export type SoundStyle = 'pop' | 'cift' | 'bloop' | 'piril' | 'mantar' | 'yukselen' | 'ahsap';

export type NotifyPrefs = {
  enabled: boolean;
  corner: 'sag-alt' | 'sag-ust';
  duration: 4 | 6 | 10;
  preview: boolean;
  sound: boolean;
  soundStyle: SoundStyle;
  volume: number; // 0–100
  hideFullscreen: boolean;
  types: Record<NotifyTypeKey, boolean>;
};

export const SOUND_OPTIONS: { value: SoundStyle; label: string }[] = [
  { value: 'pop', label: 'Baloncuk' },
  { value: 'cift', label: 'Çift baloncuk' },
  { value: 'bloop', label: 'Bloop' },
  { value: 'piril', label: 'Pırıltılı baloncuk' },
  { value: 'mantar', label: 'Mantar' },
  { value: 'yukselen', label: 'Yükselen' },
  { value: 'ahsap', label: 'Ahşap' },
];

const KEY = 'abn.bildirim.ayar';
const MUTE_KEY = 'abn.bildirim.sessiz';

export const DEFAULT_PREFS: NotifyPrefs = {
  enabled: true,
  corner: 'sag-alt',
  duration: 6,
  preview: true,
  sound: true,
  soundStyle: 'pop',
  volume: 80,
  hideFullscreen: true,
  types: { mesaj: true, anma: true, kalp: true, gorev: true, duyuru: true, oylama: true },
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function getPrefs(): NotifyPrefs {
  const p = read(KEY, DEFAULT_PREFS);
  return { ...p, types: { ...DEFAULT_PREFS.types, ...p.types } };
}

export function setPrefs(patch: Partial<NotifyPrefs>) {
  const next = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new Event('abn-bildirim-ayar'));
}

export function useNotifyPrefs(): NotifyPrefs {
  const [p, setP] = useState(getPrefs);
  useEffect(() => {
    const on = () => setP(getPrefs());
    window.addEventListener('storage', on);
    window.addEventListener('abn-bildirim-ayar', on);
    return () => {
      window.removeEventListener('storage', on);
      window.removeEventListener('abn-bildirim-ayar', on);
    };
  }, []);
  return p;
}

/** Sessize alınan sohbetler: oda id → bitiş zamanı (ms; Infinity = süresiz). */
export function muteRoom(roomId: string, ms: number) {
  const m = read<Record<string, number>>(MUTE_KEY, {});
  m[roomId] = ms === Infinity ? 8.64e15 : Date.now() + ms;
  try {
    localStorage.setItem(MUTE_KEY, JSON.stringify(m));
  } catch {}
}

export function isRoomMuted(roomId: string): boolean {
  const m = read<Record<string, number>>(MUTE_KEY, {});
  return (m[roomId] ?? 0) > Date.now();
}
