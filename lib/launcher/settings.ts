// Launcher ayarları. localStorage'da durur (açılış penceresi public/splash.html de aynı anahtarları okur).

import { invoke, isDesktop } from '@/lib/desktop';

import { createStore, readLocal, useStore, writeLocal } from './store';

export const DEFAULT_INSTALL_DIR = String.raw`C:\Oyunlar\ABN`;

export type LauncherSettings = {
  /** Bilgisayar açılınca başlat (Windows açılışında --autostart ile, tepside). */
  autostart: boolean;
  /** Kapat butonu uygulamayı tepsiye indirir. */
  closeToTray: boolean;
  /** Launcher ve oyun güncellemeleri arka planda insin. */
  autoUpdate: boolean;
  /** Oyunların kurulduğu klasör. */
  installDir: string;
};

const KEYS = {
  autostart: 'abn.launcher.autostart',
  closeToTray: 'abn.launcher.closeToTray',
  autoUpdate: 'abn.launcher.autoUpdate',
  installDir: 'abn.launcher.installDir',
} as const;

const flag = (key: string, fallback: boolean) => {
  const v = readLocal(key);
  return v === null ? fallback : v === '1';
};

const settings = createStore<LauncherSettings>({
  autostart: flag(KEYS.autostart, false),
  closeToTray: flag(KEYS.closeToTray, true),
  autoUpdate: flag(KEYS.autoUpdate, true),
  installDir: readLocal(KEYS.installDir) || DEFAULT_INSTALL_DIR,
});

export const getSettings = settings.get;
export const useSettings = () => useStore(settings);

export async function setSetting<K extends keyof LauncherSettings>(key: K, value: LauncherSettings[K]) {
  if (key === 'autostart' && isDesktop) {
    const auto = await import('@tauri-apps/plugin-autostart');
    if (value) await auto.enable();
    else await auto.disable();
  }
  if (key === 'closeToTray' && isDesktop) await invoke('set_close_to_tray', { enabled: value });
  writeLocal(KEYS[key], typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  settings.set((s) => ({ ...s, [key]: value }));
}

/** Launcher açılınca ayarları Rust tarafıyla eşitler (tepsi davranışı, gerçek otomatik başlatma durumu). */
export async function syncSettings() {
  if (!isDesktop) return;
  await invoke('set_close_to_tray', { enabled: settings.get().closeToTray }).catch(() => {});
  try {
    const auto = await import('@tauri-apps/plugin-autostart');
    const on = await auto.isEnabled();
    writeLocal(KEYS.autostart, on ? '1' : '0');
    settings.set((s) => ({ ...s, autostart: on }));
  } catch {
    // eklenti yoksa ayar olduğu gibi kalır
  }
}

/** Kurulum klasörü seçtirir (Windows klasör penceresi). */
export async function pickInstallDir(): Promise<string | null> {
  if (!isDesktop) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const dir = await open({
    directory: true,
    multiple: false,
    defaultPath: settings.get().installDir,
    title: 'Kurulum klasörü',
  });
  return typeof dir === 'string' ? dir : null;
}
