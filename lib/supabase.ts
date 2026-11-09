import './polyfills';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Ayar eksikse uygulama çökmesin; giriş ekranı bu mesajı gösterir.
export const supabaseConfigError =
  !url || !anonKey
    ? 'Supabase ayarları eksik. .env.example dosyasını .env olarak kopyalayıp EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY değerlerini gir, sonra geliştirme sunucusunu yeniden başlat.'
    : null;

// Web'de oturum localStorage'da, Android'de AsyncStorage'da durur.
// Statik web çıktısı üretilirken window yoktur; o an depolama kullanılmaz.
const webStorage = {
  getItem: (key: string) => (typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(url ?? 'http://ayar-eksik.invalid', anonKey ?? 'ayar-eksik', {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Giriş kullanıcı adı + şifreyle yapılır; adresten oturum okumaya gerek yok.
    detectSessionInUrl: false,
  },
});

// Android'de uygulama arka plana geçince token yenilemeyi durdur, öne gelince sürdür.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
