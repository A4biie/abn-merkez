import { router, usePathname } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { MiniProfile } from '@/components/profile/MiniProfile';
import { PresenceAvatar } from '@/components/profile/ProfileCard';

import { ThemeTiles } from '@/components/ThemePicker';
import { Box } from '@/components/ui/Box';
import { LogoBadge } from '@/components/Logo';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/auth';
import { useChatUnread } from '@/lib/chat';
import { statusLine } from '@/lib/presence';
import { useTheme } from '@/theme/ThemeProvider';
import { activeTab, TABS } from './nav';
import { UnreadDot } from './PhoneTabBar';
import { Kbd } from './CommandPalette';
import { openPalette } from '@/lib/palette';
import { useMe } from './useMe';

/** Desktop.dc.html'deki sol menü: sekmeler, yönetim bağlantısı, tema kutucukları, kullanıcı kartı. */
export function Sidebar() {
  const { profile } = useAuth();
  const pathname = usePathname();
  const unread = useChatUnread();
  const me = useMe();
  const { colors } = useTheme();
  // Mini profil: açık / kapanıyor (0.15 sn animasyon) / kapalı.
  const [mini, setMini] = useState<'open' | 'closing' | null>(null);
  const [meH, setMeH] = useState(58);
  const meRef = useRef<unknown>(null);
  const closeMini = useCallback(() => {
    setMini((m) => (m === 'open' ? 'closing' : m));
    setTimeout(() => setMini((m) => (m === 'closing' ? null : m)), 150);
  }, []);
  const onAdmin = pathname.startsWith('/yonetim');
  const current = activeTab(pathname);

  return (
    <Box bg="nav" border="line" style={{ width: 248, borderWidth: 0, borderRightWidth: 1, zIndex: 20 }}>
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

        <SearchButton />

        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
            <NavItem
              label={t.label}
              icon={t.icon}
              active={current === t.name}
              dot={t.name === 'sohbet' && unread}
              badge={t.badge}
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
      </ScrollView>

      <View ref={meRef as never} style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 22 }}>
        <Press
          onPress={() => (mini === 'open' ? closeMini() : setMini('open'))}
          onLayout={(e) => setMeH(e.nativeEvent.layout.height)}
          bg={mini === 'open' ? 'surface2' : 'surface'}
          hoverBg="surface2"
          pressScale={0.97}
          accessibilityLabel="Profilim"
          aria-haspopup="dialog"
          aria-expanded={mini === 'open'}
          style={{
            borderRadius: 14,
            padding: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <PresenceAvatar person={me} size={38} isMe ring={mini === 'open' ? colors.surface2 : colors.surface} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt weight={700} numberOfLines={1}>
              {me.full_name}
            </Txt>
            <Txt size={12.5} color="muted" numberOfLines={1}>
              {statusLine(me)}
            </Txt>
          </View>
        </Press>
      </View>
      {mini && <MiniProfile closing={mini === 'closing'} bottom={22 + meH + 8} onClose={closeMini} ignore={meRef} />}
    </Box>
  );
}

type NavItemProps = TabTriggerSlotProps & { label: string; icon: IconName; active: boolean; dot?: boolean; badge?: string };

// Seçili durum adresten hesaplanır (active); TabTrigger'ın isFocused'ı menü dışı kullanımda gelmiyor.
function NavItem({ label, icon, active, dot, badge, isFocused: _isFocused, ...rest }: NavItemProps) {
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
      {badge ? (
        <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: colors.a1 }}>
          <Txt size={10} weight={800} color="a1-ink" style={{ letterSpacing: 0.4 }}>
            {badge}
          </Txt>
        </View>
      ) : null}
    </Press>
  );
}

/** Yan menünün en üstündeki "Ara… Ctrl K" kutusu: komut paletini açar. */
function SearchButton() {
  const { colors } = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <Press
      onPress={openPalette}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityLabel="Ara (Ctrl K)"
      pressScale={1}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 9,
        paddingHorizontal: 10,
        marginBottom: 8,
        borderRadius: 10,
        backgroundColor: hover ? colors.surface2 : colors.surface,
      }}
    >
      <Icon name="search" size={15} color={colors.muted} strokeWidth={2} />
      <Txt size={14} weight={600} color="muted" style={{ flex: 1 }}>
        Ara…
      </Txt>
      <Kbd>{typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘ K' : 'Ctrl K'}</Kbd>
    </Press>
  );
}
