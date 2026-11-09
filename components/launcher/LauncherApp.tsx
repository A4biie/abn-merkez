// ABN Launcher penceresi (1280×800): başlık çubuğu, sol menü, sekme içeriği, durum çubuğu.
// Sadece launcher penceresinde (Tauri "main") ya da tarayıcıda ?launcher ile açılır.

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ConnectionCapsule } from '@/components/layout/ConnectionCapsule';
import { Box } from '@/components/ui/Box';
import { listenAuthLinks } from '@/lib/launcher/desktopAuth';
import { autoUpdateGames, loadInstalled, useGames } from '@/lib/launcher/games';
import { initMerkezWindow, openMerkez } from '@/lib/launcher/merkez';
import { syncSettings } from '@/lib/launcher/settings';
import { checkForUpdate } from '@/lib/launcher/updater';
import { useMotion } from '@/theme/motion';

import { Rail, StatusBar, TitleBar, type LauncherTab } from './Frame';
import { HomeTab } from './Home';
import { riseIn } from './parts';
import { DownloadsTab, GamesTab, SettingsTab } from './Tabs';

export function LauncherApp() {
  const motion = useMotion();
  const [tab, setTab] = useState<LauncherTab>('ana');
  const games = useGames();

  useEffect(() => {
    syncSettings();
    loadInstalled();
    initMerkezWindow();
    // Açılış penceresi zaten baktı; burada kart için durumu tazeler ve saatte bir yeniden bakar.
    const first = setTimeout(checkForUpdate, 2500);
    const hourly = setInterval(checkForUpdate, 60 * 60 * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(hourly);
    };
  }, []);

  // abn:// ile gelen sihirli bağlantı: oturumu aç, Merkez'i aç.
  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    listenAuthLinks(() => openMerkez())
      .then((un) => (alive ? (off = un) : un()))
      .catch(() => {});
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  // Otomatik güncelleme açıksa yeni sürümü çıkan kurulu oyunlar arka planda iner.
  useEffect(() => {
    if (games.data) autoUpdateGames(games.data);
  }, [games.data]);

  const goGames = () => setTab('oyunlar');

  return (
    <Box bg="bg" style={{ flex: 1 }}>
      <TitleBar />
      <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
        <Rail tab={tab} onTab={setTab} />
        <Animated.View key={tab} style={[{ flex: 1, minWidth: 0 }, riseIn(motion, 0)]}>
          {tab === 'ana' && <HomeTab onGames={goGames} />}
          {tab === 'oyunlar' && <GamesTab />}
          {tab === 'indirmeler' && <DownloadsTab onGames={goGames} />}
          {tab === 'ayarlar' && <SettingsTab />}
        </Animated.View>
      </View>
      <StatusBar />
      <ConnectionCapsule />
    </Box>
  );
}
