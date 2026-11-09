// Bağlantı durumu ve gönderilmeyi bekleyenler (0.7.0).
// İnternet gidince mesaj ve paylaşımlar kuyruğa alınır ("Bekliyor"); bağlantı gelince sırayla
// gönderilir. Webde tarayıcının online/offline olayları, telefonda NetInfo dinlenir. "online"
// gelince Supabase'e küçük bir istekle gerçekten ulaşılıyor mu diye bakılır (yeniden bağlanılıyor).

import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

export type ConnState = 'online' | 'offline' | 'reconnecting';

type Job = { id: string; run: () => Promise<unknown> };

let state = 'online' as ConnState;
let lastSent = 0;
const queue: Job[] = [];
const listeners = new Set<() => void>();
let snapshot = { state, pending: 0, lastSent };

function emit() {
  snapshot = { state, pending: queue.length, lastSent };
  listeners.forEach((l) => l());
}

function setState(next: ConnState) {
  if (state === next) return;
  state = next;
  emit();
}

export function isOffline() {
  return state !== 'online';
}

/** Bağlantı gelince çalışacak gönderim. Dönüş: kuyruktaki kimlik. */
export function enqueue(id: string, run: () => Promise<unknown>) {
  queue.push({ id, run });
  emit();
}

async function flush() {
  let sent = 0;
  while (queue.length) {
    const job = queue[0];
    try {
      await job.run();
      sent++;
    } catch {
      // Gönderilemeyen iş kuyrukta kalır; bir sonraki bağlantıda tekrar denenir.
      break;
    }
    queue.shift();
    emit();
  }
  lastSent = sent;
  emit();
}

let pinging = false;
async function reach() {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return true;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${base}/auth/v1/health`, { headers: { apikey: key }, signal: ctrl.signal });
    clearTimeout(timer);
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Ağ geri gelince: Supabase'e ulaşılana kadar 3 sn'de bir dene, ulaşınca kuyruğu boşalt. */
async function reconnect() {
  if (pinging) return;
  pinging = true;
  setState('reconnecting');
  while (state !== 'online') {
    if (await reach()) {
      await flush();
      setState('online');
      break;
    }
    await new Promise((r) => setTimeout(r, 3000));
    if (state === 'offline') break;
  }
  pinging = false;
}

function goOffline() {
  lastSent = 0;
  setState('offline');
}

let started = false;
function start() {
  if (started) return;
  started = true;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', () => reconnect());
    if (typeof navigator !== 'undefined' && navigator.onLine === false) goOffline();
    return;
  }
  NetInfo.addEventListener((s) => {
    if (s.isConnected === false) goOffline();
    else if (s.isConnected && state === 'offline') reconnect();
  });
}

function subscribe(l: () => void) {
  start();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** { state, pending: kuyruktaki iş sayısı, lastSent: son bağlanmada gönderilen sayı } */
export function useConnection() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
