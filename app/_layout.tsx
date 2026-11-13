import { useFonts } from 'expo-font';
import { DefaultTheme, ThemeProvider as NavThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/layout/AppBackground';
import { DesktopAppIn } from '@/components/layout/DesktopAppIn';
import { LauncherApp } from '@/components/launcher/LauncherApp';
import { MerkezBridge } from '@/components/launcher/MerkezBridge';
import { QuickIdea } from '@/components/launcher/QuickIdea';
import { BugQuick } from '@/components/launcher/BugQuick';
import { NotifyOverlay } from '@/components/notify/Overlay';
import { Splash } from '@/components/Splash';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isDesktop, isLauncherWindow, isNotifyWindow, windowLabel } from '@/lib/desktop';
import { startSessionSync } from '@/lib/launcher/desktopAuth';
import { fetchFeed, fetchProfiles } from '@/lib/queries';
import { useQuery } from '@/lib/useQuery';
import { FONT_ASSETS } from '@/theme/fonts';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();
// React Navigation kendi zeminini (#F2F2F2) çizmesin: zemini AppBackground çiziyor (düz renk + üstten ışık).
const NAV_THEME = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } };
// Masaüstü: pencereler (launcher, Merkez, hızlı fikir) oturumu paylaşır.
startSessionSync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider>
            <NavThemeProvider value={NAV_THEME}>
              <ToastProvider>
                <RootNavigator />
              </ToastProvider>
            </NavThemeProvider>
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Açılış animasyonunun beklediği ilk veri: giriş yapılmışsa ekip ve akış (aynı önbellek anahtarları,
 * ekranlar açılınca tekrar çekilmez). Giriş yapılmamışsa beklenecek veri yok.
 */
function useFirstData(enabled: boolean) {
  const { session, profile } = useAuth();
  const on = enabled && !!session;
  const profiles = useQuery(on ? 'profiles' : null, fetchProfiles);
  const feed = useQuery(on ? 'feed' : null, fetchFeed);
  if (!enabled) return false;
  if (!session) return true;
  return !!profile && !profiles.loading && !feed.loading;
}

function RootNavigator() {
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  const { loading, session } = useAuth();
  const { theme, pageBg } = useTheme();
  const ready = fontsLoaded && !loading;
  const dataReady = useFirstData(ready);
  // Masaüstünde açılışı launcher'ın kendi penceresi (public/splash.html) yapar.
  const [splashDone, setSplashDone] = useState(isDesktop || isLauncherWindow || isNotifyWindow);
  // Şeffaf küçük pencereler (hızlı fikir, bildirimler) zemin çizmez.
  const overlayWindow = isNotifyWindow || windowLabel === 'fikir' || windowLabel === 'hata';
  const finishSplash = useCallback(() => setSplashDone(true), []);

  // Expo'nun kendi açılış ekranı sadece düz renk; yazı tipleri yüklenince animasyonlu açılış başlar.
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      {/* Zemin ve üstten ışık: bütün ekranların arkasında, kaydırılınca yerinde kalır. */}
      {!overlayWindow && <AppBackground />}
      {!splashDone && <Splash ready={dataReady} onDone={finishSplash} />}
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {ready && isLauncherWindow && (
        // ABN Launcher penceresi: Merkez'in yolları yerine launcher arayüzü (Merkez ayrı pencerede açılır).
        <DesktopAppIn>
          <LauncherApp />
        </DesktopAppIn>
      )}
      {ready && windowLabel === 'fikir' && <QuickIdea />}
      {ready && windowLabel === 'hata' && <BugQuick />}
      {ready && isNotifyWindow && <NotifyOverlay />}
      {ready && !isLauncherWindow && !overlayWindow && (
        <DesktopAppIn>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: pageBg } }}>
            {/* Oturum yoksa her yol giriş ekranına, varsa giriş ekranı uygulamaya döner. */}
            <Stack.Protected guard={!!session}>
              <Stack.Screen name="(app)" />
              <Stack.Screen
                name="hosgeldin"
                options={{ title: 'Hoş geldin · ABN Merkez', animation: 'fade' }}
              />
            </Stack.Protected>
            <Stack.Protected guard={!session}>
              <Stack.Screen name="giris" options={{ title: 'Giriş · ABN Merkez' }} />
            </Stack.Protected>
          </Stack>
          <MerkezBridge />
        </DesktopAppIn>
      )}
    </>
  );
}
