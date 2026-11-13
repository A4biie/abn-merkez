import { Redirect } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { Platform } from 'react-native';
import Animated from 'react-native-reanimated';

import { BugForm } from '@/components/bugs/BugForm';
import { ConvertTaskModal } from '@/components/chat/ConvertTaskModal';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { ConnectionCapsule } from '@/components/layout/ConnectionCapsule';
import { HIDDEN_ROUTES, TABS } from '@/components/layout/nav';
import { NotificationsLive } from '@/components/layout/NotificationsLive';
import { PhoneTabBar } from '@/components/layout/PhoneTabBar';
import { SearchProvider } from '@/components/layout/Search';
import { Sidebar } from '@/components/layout/Sidebar';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { useIsWide } from '@/components/layout/useIsWide';
import { WhatsNew } from '@/components/layout/WhatsNew';
import { ActionsProvider } from '@/components/sheets/ActionsProvider';
import { Box } from '@/components/ui/Box';
import { useAuth } from '@/lib/auth';
import { useConnection } from '@/lib/connection';
import { useMotion } from '@/theme/motion';

/**
 * Uygulama iskeleti. 900px altında alt menü (Main.dc.html), üstünde sol menü (Desktop.dc.html).
 * Görünmez TabList bütün yolları kaydeder; menüdeki butonlar aynı TabTrigger'ları kullanır.
 */
export default function AppLayout() {
  const wide = useIsWide();
  const motion = useMotion();
  // Bağlantı yokken sayfa soluk ve gri (webde gri tonlama, telefonda sadece solukluk).
  const away = useConnection().state !== 'online';
  const { profile } = useAuth();

  // Profilini henüz tamamlamamış kişi önce hoş geldin turunu görür (0.7.0).
  if (profile && !profile.onboarded) return <Redirect href="/hosgeldin" />;

  return (
    <Tabs options={{ backBehavior: 'history' }} style={{ flex: 1 }}>
      <TabList style={{ display: 'none' }}>
        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} />
        ))}
        {HIDDEN_ROUTES.map((r) => (
          <TabTrigger key={r.name} name={r.name} href={r.href} />
        ))}
      </TabList>
      <NotificationsLive />
      <WhatsNew />
      <ProfileModal />
      <ProfileEditor />
      <SearchProvider>
        <ActionsProvider>
          <Box bg="bg" style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
            {wide && <Sidebar />}
            <Animated.View
              style={[
                { flex: 1, minWidth: 0, opacity: away ? 0.5 : 1 },
                Platform.OS === 'web'
                  ? ({ filter: away ? 'grayscale(0.85)' : 'grayscale(0)' } as object)
                  : null,
                motion.transition(['opacity'], 400),
              ]}
            >
              {/* TabSlot kendiliğinden küçülmüyor (flexShrink: 0); içerik uzayınca sayfa kaydırılamıyordu. */}
              <TabSlot style={{ flexShrink: 1, flexBasis: 0, minHeight: 0 }} />
            </Animated.View>
            {!wide && <PhoneTabBar />}
            <ConnectionCapsule />
          </Box>
          <CommandPalette />
          <ConvertTaskModal />
          <BugForm />
        </ActionsProvider>
      </SearchProvider>
    </Tabs>
  );
}
