// Merkez penceresi (Tauri "merkez") için görünmez yardımcı:
//  - launcher'ın istediği sayfayı açar (ilk açılışta window.__ABN_START__, sonra "merkez://navigate");
//  - hangi sayfada olunduğunu "merkez://route" ile bildirir (bildirim penceresi açık sohbetten kart göstermez).

import { router, usePathname, type Href } from 'expo-router';
import { useEffect } from 'react';

import { isDesktop, listenDesktop, windowLabel } from '@/lib/desktop';

export function MerkezBridge() {
  const pathname = usePathname();

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

  useEffect(() => {
    if (!isDesktop || windowLabel !== 'merkez') return;
    import('@tauri-apps/api/event').then(({ emit }) => emit('merkez://route', pathname)).catch(() => {});
  }, [pathname]);

  return null;
}
