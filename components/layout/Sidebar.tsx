import { router, usePathname } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { ScrollView, View } from 'react-native';

import { ThemeTiles } from '@/components/ThemePicker';
import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { LogoBadge } from '@/components/Logo';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/auth';
import { useChatUnread } from '@/lib/chat';
import { AVAILABILITY } from '@/lib/labels';
import { useTheme } from '@/theme/ThemeProvider';
import { activeTab, TABS } from './nav';
import { UnreadDot } from './PhoneTabBar';
import { useMe } from './useMe';

/** Desktop.dc.html'deki sol menü: sekmeler, yönetim bağlantısı, tema kutucukları, kullanıcı kartı. */
export function Sidebar() {
  const { profile } = useAuth();
  const pathname = usePathname();
  const unread = useChatUnread();
  const me = useMe();
  const avail = AVAILABILITY[me.availability];
  const onAdmin = pathname.startsWith('/yonetim');
  const current = activeTab(pathname);

  return (
    <Box bg="nav" border="line" style={{ width: 248, borderWidth: 0, borderRightWidth: 1 }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingVertical: 22, paddingHorizontal: 14, gap: 4 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 8,
            paddingBottom: 18,
          }}
        >
          <LogoBadge size={38} />
          <View>
            <Txt size={16} weight={800} leading={1.3}>
              ABN Merkez
            </Txt>
            <Txt size={12.5} color="muted" leading={1.3}>
              Abby&apos;s Nexus
            </Txt>
          </View>
        </View>

        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
            <NavItem
              label={t.label}
              icon={t.icon}
              active={current === t.name}
              dot={t.name === 'sohbet' && unread}
            />
          </TabTrigger>
        ))}

        {profile?.is_admin && (
          <View style={{ gap: 4, marginTop: 14 }}>
            <Txt
              size={11.5}
              weight={700}
              color="faint"
              style={{ letterSpacing: 0.92, paddingHorizontal: 12, paddingBottom: 4 }}
            >
              YÖNETİM
            </Txt>
            <NavItem
              label="Yönetim paneli"
              icon="shield"
              active={onAdmin}
              onPress={() => router.navigate('/yonetim')}
            />
          </View>
        )}

        <View style={{ flexGrow: 1, minHeight: 24 }} />
        <ThemeTiles />

        <Press
          onPress={() => router.navigate('/profil')}
          bg="surface"
          hoverBg="hover"
          pressScale={0.97}
          accessibilityLabel="Profilim"
          style={{
            marginTop: 14,
            borderRadius: 14,
            padding: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Avatar person={me} size={38} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt weight={700} numberOfLines={1}>
              {me.full_name}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: avail.color }} />
              <Txt size={12.5} color="muted">
                {avail.label}
              </Txt>
            </View>
          </View>
        </Press>
      </ScrollView>
    </Box>
  );
}

type NavItemProps = TabTriggerSlotProps & { label: string; icon: IconName; active: boolean; dot?: boolean };

// Seçili durum adresten hesaplanır (active); TabTrigger'ın isFocused'ı menü dışı kullanımda gelmiyor.
function NavItem({ label, icon, active, dot, isFocused: _isFocused, ...rest }: NavItemProps) {
  const { colors } = useTheme();
  return (
    <Press
      {...rest}
      bg={active ? 'nav-pill' : undefined}
      gradient={active ? 'pill' : undefined}
      hoverBg={active ? 'nav-pill' : 'hover'}
      pressScale={0.97}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      style={{
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View>
        <Icon name={icon} size={20} color={active ? colors['accent-text'] : colors['text-2']} />
        {dot && <UnreadDot />}
      </View>
      <Txt weight={600} color={active ? 'accent-text' : 'text-2'} style={{ flex: 1 }}>
        {label}
      </Txt>
    </Press>
  );
}
