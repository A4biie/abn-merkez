import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { unregisterPush } from './push';
import { supabase, supabaseConfigError } from './supabase';
import type { Profile } from './types';
import { clearQueryCache, invalidate, mutateCache } from './useQuery';

type AuthState = {
  /** İlk oturum kontrolü bitene kadar true; bu sırada açılış ekranı görünür kalır. */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(!supabaseConfigError);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (supabaseConfigError) return;
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;
  // Oturum değişince eski kişinin profili bir an bile görünmesin.
  const currentProfile = profile && profile.id === userId ? profile : null;

  const fetchProfile = useCallback(async () => {
    if (!userId) return null;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    return (data as Profile | null) ?? null;
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    setProfile(await fetchProfile());
  }, [fetchProfile]);

  useEffect(() => {
    let alive = true;
    fetchProfile().then((p) => {
      if (alive && p) setProfile(p);
    });
    return () => {
      alive = false;
    };
  }, [fetchProfile]);

  // Profil değişiklikleri canlı (bölüm 4): bir ekip üyesi profilini değiştirince kenar çubuğu, sohbet, ekip listesi
  // ve açık kart / pencere sayfa yenilenmeden güncellenir.
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`profiller:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        const row = payload.new as Profile | undefined;
        if (!row?.id) return invalidate('profiles');
        mutateCache<Profile[]>('profiles', (prev) => {
          const list = prev ?? [];
          return list.some((p) => p.id === row.id) ? list.map((p) => (p.id === row.id ? { ...p, ...row } : p)) : [...list, row];
        });
        if (row.id === userId) setProfile((p) => (p ? { ...p, ...row } : p));
      })
      .subscribe();
    return () => {
      ch.unsubscribe();
    };
  }, [userId]);

  // Özel durumun süresi dolunca: ekranda hemen kalkar ve veritabanından da temizlenir.
  const expiresAt = profile?.custom_status ? profile.custom_status_expires_at : null;
  useEffect(() => {
    if (!expiresAt || !userId) return;
    const clear = () => {
      setProfile((p) => (p ? { ...p, custom_status: '', custom_status_emoji: '', custom_status_expires_at: null } : p));
      supabase
        .from('profiles')
        .update({ custom_status: '', custom_status_emoji: '', custom_status_expires_at: null })
        .eq('id', userId)
        .then(() => invalidate('profiles'));
    };
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) {
      clear();
      return;
    }
    const t = setTimeout(clear, Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [expiresAt, userId]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!userId) return 'Önce giriş yapmalısın.';
      setProfile((p) => (p ? { ...p, ...patch } : p));
      // Ekip listesi, sohbet ve kartlar da hemen güncellensin (iyimser).
      mutateCache<Profile[]>('profiles', (prev) => prev?.map((p) => (p.id === userId ? { ...p, ...patch } : p)) ?? []);
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
      if (error) {
        await refreshProfile();
        invalidate('profiles');
        return 'Değişiklik kaydedilemedi. Biraz sonra tekrar dene.';
      }
      invalidate('profiles');
      return null;
    },
    [userId, refreshProfile],
  );

  const signOut = useCallback(async () => {
    await unregisterPush();
    await supabase.auth.signOut();
    setProfile(null);
    clearQueryCache();
  }, []);

  const value = useMemo(
    () => ({ loading, session, profile: currentProfile, refreshProfile, updateProfile, signOut }),
    [loading, session, currentProfile, refreshProfile, updateProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı.');
  return ctx;
}

/** Kullanıcı adı, Supabase Auth'ta bu biçimde bir e-postaya çevrilir (bkz. login_email migration'ı). */
export const LOGIN_DOMAIN = 'abnmerkez.local';
export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

export function normalizeUsername(raw: string) {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

/** Kullanıcı adı ve şifreyle giriş. Hata varsa Türkçe açıklamasını döndürür. */
export async function signInWithUsername(username: string, password: string): Promise<string | null> {
  if (supabaseConfigError) return supabaseConfigError;
  const name = normalizeUsername(username);
  if (!USERNAME_RE.test(name)) return 'Kullanıcı adı ya da şifre yanlış. Bir daha dener misin?';

  const { error } = await supabase.auth.signInWithPassword({ email: `${name}@${LOGIN_DOMAIN}`, password });
  if (!error) return null;

  const msg = error.message.toLowerCase();
  if (error.code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return 'Kullanıcı adı ya da şifre yanlış. Bir daha dener misin?';
  }
  if (error.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return 'Kısa sürede çok deneme yapıldı. Birkaç dakika sonra tekrar dene.';
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.';
  }
  return 'Şu an giriş yapılamadı. Biraz sonra tekrar dene.';
}

/**
 * Kişi kendi şifresini değiştirir. Açık unutulmuş bir cihazda başkası değiştiremesin diye önce
 * mevcut şifre doğrulanır. Hata varsa Türkçe açıklamasını döndürür.
 */
export async function changePassword(current: string, next: string): Promise<string | null> {
  if (next.length < 6) return 'Yeni şifre en az 6 karakter olmalı.';
  if (next === current) return 'Yeni şifre eskisinden farklı olmalı.';
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email;
  if (!email) return 'Oturumun sona ermiş. Çıkış yapıp yeniden gir.';

  const check = await supabase.auth.signInWithPassword({ email, password: current });
  if (check.error) {
    if (check.error.status === 429) return 'Kısa sürede çok deneme yapıldı. Birkaç dakika sonra tekrar dene.';
    return 'Mevcut şifren yanlış görünüyor. Bir daha dener misin?';
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (!error) return null;
  if (error.code === 'same_password') return 'Yeni şifre eskisinden farklı olmalı.';
  if (error.code === 'weak_password') return 'Bu şifre çok zayıf. Daha uzun ya da tahmini zor bir şifre dene.';
  if (error.message.toLowerCase().includes('fetch')) return 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.';
  return 'Şifre şu an değiştirilemedi. Biraz sonra tekrar dene.';
}
