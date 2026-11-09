// ABN Merkez penceresi (1440×900). Rust açar ya da öne getirir; açılıp kapanınca "merkez://state" gelir.

import { invoke, isDesktop, launcherDemo, listenDesktop } from '@/lib/desktop';

import { createStore, readLocal, useStore, writeLocal } from './store';

const store = createStore({ open: false });
export const useMerkezWindow = () => useStore(store);

export async function openMerkez(path?: string) {
  if (launcherDemo) {
    store.set({ open: true });
    return;
  }
  if (!isDesktop) return;
  await invoke('open_merkez', { path: path ?? null });
}

listenDesktop<{ open: boolean }>('merkez://state', (s) => store.set({ open: s.open }));

/** Launcher açılınca: Merkez zaten açık mı, güncellemeden sonra açılması isteniyor mu? */
export async function initMerkezWindow() {
  if (!isDesktop) return;
  const open = await invoke<boolean>('merkez_is_open').catch(() => false);
  store.set({ open });
  if (readLocal('abn.launcher.openMerkezOnStart') === '1') {
    writeLocal('abn.launcher.openMerkezOnStart', null);
    await openMerkez();
  }
}
