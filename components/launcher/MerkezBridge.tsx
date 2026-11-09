// Merkez penceresi (Tauri "merkez") için görünmez yardımcı: launcher'ın istediği sayfayı açar
// (ilk açılışta window.__ABN_START__, sonra "merkez://navigate" olayıyla).

import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { listenDesktop, windowLabel } from '@/lib/desktop';

export function MerkezBridge() {
  useEffect(() => {
    if (windowLabel !== 'merkez') return;
    const start = (window as unknown as { __ABN_START__?: string }).__ABN_START__;
    const t = start ? setTimeout(() => router.replace(start as Href), 50) : undefined;
    const off = listenDesktop<string>('merkez://navigate', (path) => router.navigate(path as Href));
    return () => {
      if (t) clearTimeout(t);
      off();
    };
  }, []);
  return null;
}
