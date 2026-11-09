// Masaüstü (ABN Launcher, Tauri 2) kontrolü. Masaüstüne özel her şey isDesktop'un arkasında durur;
// web ve telefonda bu dosyadaki Tauri modülleri hiç yüklenmez (dinamik import).

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

type TauriInternals = { metadata?: { currentWindow?: { label?: string } } };
const internals: TauriInternals | undefined =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? (window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__
    : undefined;

/** Uygulama ABN Launcher'ın içinde mi çalışıyor? (Tauri, pencereye __TAURI_INTERNALS__ ekler.) */
export const isDesktop: boolean = !!internals;

/**
 * Bu pencerenin etiketi: "main" (launcher), "merkez" (ABN Merkez), "fikir" (hızlı fikir).
 * Tarayıcıda null; geliştirirken ?launcher ile launcher arayüzü denenebilir (örnek verilerle).
 */
export const windowLabel: string | null = internals?.metadata?.currentWindow?.label ?? null;

/** Tarayıcıda launcher arayüzünü örnek verilerle denemek için: http://localhost:8081/?launcher */
export const launcherDemo: boolean =
  !isDesktop &&
  Platform.OS === 'web' &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('launcher');

/** Tarayıcıda bildirim kartlarını denemek için: http://localhost:8081/?bildirim */
export const notifyDemo: boolean =
  !isDesktop &&
  Platform.OS === 'web' &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('bildirim');

/** Bu pencere bildirim kartlarının penceresi mi (gerçek ya da tarayıcıda deneme)? */
export const isNotifyWindow = windowLabel === 'bildirim' || notifyDemo;

/** Bu pencere launcher mı (gerçek ya da tarayıcıda deneme)? */
export const isLauncherWindow = windowLabel === 'main' || launcherDemo;

// Tauri pencereyi /index.html ile açarsa Expo Router kök yolu tanısın.
if (isDesktop && typeof location !== 'undefined' && location.pathname.endsWith('/index.html')) {
  history.replaceState(null, '', '/' + location.search + location.hash);
}

/** Rust komutu çağırır (src-tauri/src/lib.rs). Masaüstü değilse hata verir. */
export async function invoke<T = void>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isDesktop) throw new Error("Bu işlem sadece ABN Launcher'da çalışır.");
  const core = await import('@tauri-apps/api/core');
  return core.invoke<T>(cmd, args);
}

/** Rust'tan gelen bir olayı dinler; dönen fonksiyon aboneliği kapatır. */
export function listenDesktop<T>(event: string, fn: (payload: T) => void): () => void {
  if (!isDesktop) return () => {};
  let off: (() => void) | undefined;
  let alive = true;
  import('@tauri-apps/api/event')
    .then(({ listen }) => listen<T>(event, (e) => fn(e.payload)))
    .then((un) => {
      if (alive) off = un;
      else un();
    })
    .catch(() => {});
  return () => {
    alive = false;
    off?.();
  };
}

/** Bu pencerenin küçült / büyüt / kapat işlemleri (kendi başlık çubuğumuz için). */
export async function windowAction(action: 'minimize' | 'toggleMaximize' | 'close') {
  if (!isDesktop) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const w = getCurrentWindow();
  if (action === 'minimize') await w.minimize();
  else if (action === 'toggleMaximize') await w.toggleMaximize();
  else await w.close(); // launcher'da Rust bunu "tepsiye indir"e çevirir (ayara göre)
}

/** Pencere büyütülmüş mü? Başlık çubuğundaki büyüt/geri al ikonu için. */
export function useMaximized(): boolean {
  const [max, setMax] = useState(false);
  useEffect(() => {
    if (!isDesktop) return;
    let un: (() => void) | undefined;
    let alive = true;
    import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const w = getCurrentWindow();
      const sync = () => w.isMaximized().then((m) => alive && setMax(m));
      await sync();
      const off = await w.onResized(sync);
      if (alive) un = off;
      else off();
    });
    return () => {
      alive = false;
      un?.();
    };
  }, []);
  return max;
}

/** Launcher'ın kendi sürümü (src-tauri/tauri.conf.json). Merkez'in sürümü ayrı: lib/version.ts. */
export async function getLauncherVersion(): Promise<string | null> {
  if (!isDesktop) return launcherDemo ? '1.0.0' : null;
  const { getVersion } = await import('@tauri-apps/api/app');
  return getVersion();
}

/** Masaüstündeyken Launcher sürümü, değilse null. */
export function useLauncherVersion(): string | null {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    if (!isDesktop && !launcherDemo) return;
    let alive = true;
    getLauncherVersion()
      .then((x) => alive && setV(x))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return v;
}
