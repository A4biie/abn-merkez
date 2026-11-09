// Launcher güncellemesi (Merkez de launcher'ın içinde geldiği için "Merkez güncellemesi" aynı şey).
// Açılış penceresi otomatik indirme açıksa güncellemeyi orada kurar; kapalıysa burada kartta
// "Güncelle · 24 MB" çıkar, basınca yerinde ilerleme çubuğuyla iner, sonra "Yeniden başlat ve aç".

import type { Update } from '@tauri-apps/plugin-updater';

import { isDesktop, launcherDemo } from '@/lib/desktop';

import { getSettings } from './settings';
import { createStore, useStore, writeLocal } from './store';

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
type State = { phase: UpdatePhase; version?: string; size?: number; progress: number; error?: string };

const store = createStore<State>({ phase: 'idle', progress: 0 });
export const useLauncherUpdate = () => useStore(store);
let pending: Update | null = null;

/** Güncelleme var mı bakar. Otomatik indirme açıksa hemen indirmeye başlar. */
export async function checkForUpdate(): Promise<boolean> {
  if (launcherDemo) {
    const demo = new URLSearchParams(location.search).get('guncelleme');
    if (demo !== null) store.set({ phase: 'available', version: '1.0.1', size: 24 * 1024 ** 2, progress: 0 });
    return demo !== null;
  }
  if (!isDesktop) return false;
  const s = store.get();
  if (s.phase === 'downloading' || s.phase === 'ready') return true;
  store.set({ phase: 'checking', progress: 0 });
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    pending = await check();
    if (!pending) {
      store.set({ phase: 'idle', progress: 0 });
      return false;
    }
    store.set({ phase: 'available', version: pending.version, size: await sizeOf(pending), progress: 0 });
    if (getSettings().autoUpdate) void downloadUpdate();
    return true;
  } catch (e) {
    store.set({ phase: 'idle', progress: 0, error: String(e) });
    return false;
  }
}

/** Kurulum dosyasının boyutu (latest.json'da yazmaz; dosyaya HEAD isteğiyle bakılır). */
async function sizeOf(u: Update): Promise<number | undefined> {
  try {
    const raw = u.rawJson as { platforms?: Record<string, { url?: string }> };
    const url = raw.platforms?.['windows-x86_64']?.url;
    if (!url) return undefined;
    const res = await fetch(url, { method: 'HEAD' });
    const n = Number(res.headers.get('content-length'));
    return n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

export async function downloadUpdate() {
  if (launcherDemo) {
    store.set((s) => ({ ...s, phase: 'downloading', progress: 0 }));
    const iv = setInterval(() => {
      const p = Math.min(100, store.get().progress + 2 + Math.random() * 4);
      store.set((s) => ({ ...s, progress: p, phase: p >= 100 ? 'ready' : 'downloading' }));
      if (p >= 100) clearInterval(iv);
    }, 120);
    return;
  }
  if (!pending) return;
  store.set((s) => ({ ...s, phase: 'downloading', progress: 0 }));
  let total = 0;
  let got = 0;
  try {
    await pending.download((ev) => {
      if (ev.event === 'Started') total = ev.data.contentLength ?? 0;
      else if (ev.event === 'Progress') {
        got += ev.data.chunkLength;
        if (total) store.set((s) => ({ ...s, progress: Math.min(100, (got / total) * 100) }));
      }
    });
    store.set((s) => ({ ...s, phase: 'ready', progress: 100 }));
  } catch (e) {
    store.set((s) => ({ ...s, phase: 'available', progress: 0, error: String(e) }));
  }
}

/** Kurar ve yeniden başlatır; açılınca Merkez kendiliğinden açılır. */
export async function installAndRelaunch() {
  if (launcherDemo) {
    store.set({ phase: 'idle', progress: 0 });
    return;
  }
  if (!pending) return;
  writeLocal('abn.launcher.openMerkezOnStart', '1');
  writeLocal('abn.launcher.justUpdated', pending.version);
  await pending.install(); // Windows'ta kurulum başlarken uygulama kapanır
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
