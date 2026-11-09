import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { useAuth } from '@/lib/auth';
import { defaultTheme, resolveTheme, THEMES, type Palette, type ThemeDef, type ThemeName } from './themes';

const STORAGE_KEY = 'abn.theme';

type ThemeState = {
  name: ThemeName;
  theme: ThemeDef;
  colors: Palette;
  /** Sayfaların kendi zemini: gradyanlı temada şeffaf (arkadaki AppBackground görünsün), düzde bg. */
  pageBg: string;
  setTheme: (name: ThemeName) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

// Webde react-native-web'in bilmediği birkaç küresel kural (prototipteki <style> bloğundan).
const WEB_CSS = `
html, body, #root { height: 100%; }
body { margin: 0; transition: background-color .45s ease; }
* { -webkit-tap-highlight-color: transparent; }
*::-webkit-scrollbar { display: none; }
* { scrollbar-width: none; }
svg * { transition: stroke .45s ease, fill .45s ease; }
input, textarea { outline: none; }
:focus-visible { outline: 2px solid var(--abn-accent) !important; outline-offset: 2px; }
[data-board="field"]:focus-visible { outline: none !important; }
@media (prefers-reduced-motion: reduce) { *, svg * { transition: none !important; animation: none !important; } }
`;

function applyWebChrome(def: ThemeDef) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  let style = document.getElementById('abn-global') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'abn-global';
    style.textContent = WEB_CSS;
    document.head.appendChild(style);
  }
  const root = document.documentElement;
  // Büyük/küçük harf ve tarih kuralları Türkçe olsun (i → İ).
  root.lang = 'tr';
  root.style.setProperty('--abn-accent', def.colors['accent-text']);
  root.style.colorScheme = def.scheme;
  document.body.style.backgroundColor = def.colors.bg;
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = def.colors.bg;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { profile, updateProfile } = useAuth();
  // Hiç seçim yoksa sistem: koyu modda Gece Yarısı, açık modda Nane.
  const system = defaultTheme(useColorScheme());
  // Giriş yapılmamışken (giriş ekranı) cihazdaki son seçim kullanılır.
  const [local, setLocal] = useState<ThemeName | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      const t = resolveTheme(saved);
      if (t) setLocal(t);
    });
  }, []);

  // Giriş yapılınca profildeki tema geçerli olur; başka cihazda seçilen tema buraya da gelir.
  // Kaldırılmış eski bir tema adı yenisine çevrilir (dark → Gece Yarısı, light → Nane).
  const name = resolveTheme(profile?.theme) ?? local ?? system;

  useEffect(() => {
    applyWebChrome(THEMES[name]);
    AsyncStorage.setItem(STORAGE_KEY, name);
  }, [name]);

  const setTheme = useCallback(
    (next: ThemeName) => {
      setLocal(next);
      // updateProfile profili hemen günceller, kayıt arkada yapılır.
      if (profile && profile.theme !== next) updateProfile({ theme: next });
    },
    [profile, updateProfile],
  );

  const value = useMemo(
    () => ({
      name,
      theme: THEMES[name],
      colors: THEMES[name].colors,
      pageBg: THEMES[name].gradients ? 'transparent' : THEMES[name].colors.bg,
      setTheme,
    }),
    [name, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme, ThemeProvider içinde kullanılmalı.');
  return ctx;
}
