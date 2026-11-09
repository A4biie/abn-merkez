// Masaüstünde birden çok pencere (launcher, Merkez, hızlı fikir) aynı oturumu kullanır.
// Bir pencerede giriş/çıkış yapılınca localStorage değişir; diğerleri "storage" olayıyla eşitlenir.
// abn:// bağlantısı (sihirli bağlantı) gelince oturum o bağlantıdaki anahtarlarla açılır.

import { isDesktop, launcherDemo } from '@/lib/desktop';
import { supabase } from '@/lib/supabase';

let started = false;

export function startSessionSync() {
  if (!isDesktop || started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('storage', async (e) => {
    if (!e.key || !e.key.startsWith('sb-') || !e.key.endsWith('-auth-token')) return;
    const { data } = await supabase.auth.getSession();
    if (!e.newValue) {
      if (data.session) await supabase.auth.signOut({ scope: 'local' });
      return;
    }
    try {
      const next = JSON.parse(e.newValue) as { access_token?: string; refresh_token?: string };
      if (!next.access_token || !next.refresh_token) return;
      if (data.session?.access_token === next.access_token) return; // aynı oturum: döngüye girme
      await supabase.auth.setSession({ access_token: next.access_token, refresh_token: next.refresh_token });
    } catch {
      // bozuk değer: yok say
    }
  });
}

/**
 * abn://giris#access_token=…&refresh_token=… (sihirli bağlantı, davet, şifre sıfırlama) ya da
 * abn://giris?code=… (PKCE). Oturum açılırsa true döner.
 */
export async function handleAuthLink(url: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
  const access = hash.get('access_token');
  const refresh = hash.get('refresh_token');
  if (access && refresh) {
    const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
    return !error;
  }
  const code = u.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  }
  return false;
}

/** Launcher açılırken ve çalışırken gelen abn:// bağlantılarını dinler. */
export async function listenAuthLinks(onSignedIn: () => void): Promise<() => void> {
  if (!isDesktop || launcherDemo) return () => {};
  const dl = await import('@tauri-apps/plugin-deep-link');
  const handle = async (urls: string[] | null) => {
    for (const url of urls ?? []) if (await handleAuthLink(url)) onSignedIn();
  };
  await handle(await dl.getCurrent().catch(() => null));
  return dl.onOpenUrl((urls) => void handle(urls));
}
