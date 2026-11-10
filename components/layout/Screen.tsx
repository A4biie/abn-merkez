import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, ScrollView, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActions } from '@/components/sheets/ActionsProvider';
import { ThemeList } from '@/components/ThemePicker';
import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { Button } from '@/components/ui/Controls';
import { LogoBadge } from '@/components/Logo';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Sheet } from '@/components/ui/Sheet';
import { Stagger } from '@/components/ui/Stagger';
import { Txt } from '@/components/ui/Txt';
import { NOTIFICATION_DOT } from '@/lib/labels';
import { openProfile } from '@/lib/profileModal';
import { useNotifications } from '@/lib/queries';
import { dayLabel } from '@/lib/time';
import { fontFamily } from '@/theme/fonts';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { PullToRefresh } from './PullToRefresh';
import { useSearch } from './Search';
import { useHasUnread } from './useHasUnread';
import { useIsWide } from './useIsWide';
import { useMe } from './useMe';

type Props = {
  /** Sayfa başlığı (bilgisayarda başlık şeridinde, telefonda büyük başlık). */
  title: string;
  /** Bilgisayarda başlığın üstündeki küçük satır. */
  crumb?: string;
  /** Telefonda büyük başlık farklı olacaksa (Akış: "Hoş geldin, Ece"). */
  phoneTitle?: string;
  /** Alt sayfalarda geri butonu. Metin verilirse butonda o yazar ("Projeler"). */
  back?: boolean | string;
  /** Telefonda başlığın sağındaki buton (ör. "Görev ekle"). */
  action?: ReactNode;
  /** Bilgisayarda başlık şeridindeki ana buton. Verilmezse "Yeni görev". */
  wideAction?: ReactNode;
  /** Sayfa kendi başlığını çiziyorsa (profil afişi) telefondaki başlık gizlenir. */
  bare?: boolean;
  /** Bilgisayarda arama kutusu gösterilsin mi (Görevler, Fikirler). */
  search?: boolean;
  /** Telefonda aşağı çekip yenile. */
  onRefresh?: () => Promise<unknown>;
  children?: ReactNode;
};

/** Bütün sekmelerin ortak sayfa kalıbı. Sayfaya her gelişte içerik sırayla belirir. */
export function Screen({
  title,
  crumb,
  phoneTitle,
  back,
  action,
  wideAction,
  bare,
  search,
  onRefresh,
  children,
}: Props) {
  const wide = useIsWide();
  const insets = useSafeAreaInsets();
  const [visit, setVisit] = useState(0);
  const actions = useActions();
  const motion = useMotion();

  // Sekmeler bellekte kalır; her ziyarette giriş animasyonu baştan oynasın.
  useFocusEffect(useCallback(() => setVisit((v) => v + 1), []));

  const kind = back ? 'push' : 'enter';
  // Detay sayfası webde sağdan girer; telefonda (Android) bunu yerel yığın geçişi yapar.
  const page = back && Platform.OS === 'web' ? motion.page() : null;
  const backLabel = typeof back === 'string' ? back : 'Geri';

  if (wide) {
    return (
      <Animated.View key={visit} style={[{ flex: 1 }, page]}>
        <Box
          border="line"
          style={{
            zIndex: 10,
            borderWidth: 0,
            borderBottomWidth: 1,
            paddingVertical: 20,
            paddingHorizontal: 32,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <View style={{ flex: 1, minWidth: 200 }}>
            {!!crumb && (
              <Txt size={13} color="muted">
                {crumb}
              </Txt>
            )}
            <Txt size={28} weight={700} leading={1.15} style={{ letterSpacing: -0.28 }} role="heading">
              {title}
            </Txt>
          </View>
          {search && <SearchBox />}
          <BellMenu />
          {wideAction ?? (
            <Button label="Yeni görev" kind="accent" icon="plus" onPress={() => actions.openAddTask()} />
          )}
        </Box>
        <ScrollView contentContainerStyle={{ paddingTop: 28, paddingHorizontal: 32, paddingBottom: 56 }}>
          <Stagger key={visit} kind={kind} gap={20}>
            {back && <BackButton label={backLabel} />}
            {children}
          </Stagger>
        </ScrollView>
      </Animated.View>
    );
  }

  return (
    <Animated.View key={visit} style={[{ flex: 1 }, page]}>
      <PullToRefresh
        onRefresh={onRefresh}
        contentContainerStyle={{
          paddingTop: bare ? 0 : 24 + insets.top,
          paddingHorizontal: bare ? 0 : 20,
          paddingBottom: 28,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Stagger key={visit} kind={kind} gap={18}>
          {!bare && (back ? <BackButton label={backLabel} /> : <PhoneTopBar />)}
          {!bare && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Txt
                size={32}
                weight={600}
                leading={1.1}
                style={{ flex: 1, letterSpacing: -0.32, marginTop: back ? 0 : 4 }}
                role="heading"
              >
                {phoneTitle ?? title}
              </Txt>
              {action}
            </View>
          )}
          {children}
        </Stagger>
      </PullToRefresh>
    </Animated.View>
  );
}

/** Akış'taki üst satır: logo, tema seçici, zil ve profil (Main.dc.html). */
function PhoneTopBar() {
  const { colors } = useTheme();
  const me = useMe();
  const [themeOpen, setThemeOpen] = useState(false);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <LogoBadge size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={16} weight={700} leading={1.3}>
          Abby&apos;s Nexus
        </Txt>
        <Txt size={13} color="muted" leading={1.3}>
          Ekip paneli
        </Txt>
      </View>
      <Press
        onPress={() => setThemeOpen(true)}
        accessibilityLabel="Tema seç"
        bg="surface"
        shadow
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="palette" size={20} color={colors.text} />
      </Press>
      <BellButton size={44} onPress={() => router.navigate('/bildirimler')} />
      <Press
        onPress={() => openProfile('id' in me ? me.id : null)}
        accessibilityLabel="Profilim"
        style={{ borderRadius: 22 }}
      >
        <Avatar person={me} size={44} />
      </Press>
      <Sheet open={themeOpen} onClose={() => setThemeOpen(false)} label="Tema seç">
        <ThemeList />
      </Sheet>
    </View>
  );
}

function SearchBox() {
  const { colors } = useTheme();
  const { query, setQuery } = useSearch();
  return (
    <Box
      bg="surface"
      shadow
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        paddingHorizontal: 14,
        height: 42,
        width: 280,
        maxWidth: '100%',
      }}
    >
      <Icon name="search" size={17} color={colors.muted} strokeWidth={2} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Görev ya da fikir ara…"
        placeholderTextColor={colors.faint}
        aria-label="Görev ve fikir ara"
        style={{ flex: 1, minWidth: 0, color: colors.text, fontFamily: fontFamily(400), fontSize: 14.5 }}
      />
    </Box>
  );
}

function BellButton({ size, onPress, expanded }: { size: number; onPress: () => void; expanded?: boolean }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const unread = useHasUnread();
  const dotPos = size >= 44 ? { top: 10, right: 11 } : { top: 9, right: 10 };

  return (
    <Press
      onPress={onPress}
      accessibilityLabel={unread ? 'Bildirimler, yeni bildirim var' : 'Bildirimler'}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      bg="surface"
      shadow
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="bell" size={size >= 44 ? 20 : 19} color={colors.text} />
      {unread && (
        <View style={{ position: 'absolute', ...dotPos }}>
          <Animated.View
            style={[
              { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.a2 },
              motion.ring(),
            ]}
          />
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.a2 }} />
        </View>
      )}
    </Press>
  );
}

/** Bilgisayarda zile basınca açılan "Son olanlar" (Desktop.dc.html). */
function BellMenu() {
  const motion = useMotion();
  const [open, setOpen] = useState(false);
  const { data } = useNotifications();
  const items = (data ?? []).slice(0, 5);

  return (
    <View style={{ zIndex: 20 }}>
      <BellButton size={42} expanded={open} onPress={() => setOpen((o) => !o)} />
      {open && (
        <Animated.View style={[{ position: 'absolute', top: 52, right: 0, width: 340 }, motion.dialog()]}>
          <Box
            bg="surface"
            border="line"
            style={{ borderRadius: 20, padding: 16, gap: 10, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
          >
            <Txt weight={700}>Son olanlar</Txt>
            {items.length === 0 && (
              <Txt size={14} color="muted">
                Şimdilik yeni bir şey yok.
              </Txt>
            )}
            {items.map((n) => (
              <Press
                key={n.id}
                onPress={() => {
                  setOpen(false);
                  if (n.link) router.navigate(n.link as Href);
                }}
                hoverBg="hover"
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'flex-start',
                  borderRadius: 10,
                  padding: 4,
                  margin: -4,
                }}
              >
                <View
                  style={{
                    width: 9,
                    height: 9,
                    marginTop: 6,
                    borderRadius: 5,
                    backgroundColor: NOTIFICATION_DOT[n.kind],
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Txt size={14} weight={n.read_at ? 400 : 600}>
                    {n.text}
                  </Txt>
                  <Txt size={12} color="muted">
                    {dayLabel(n.created_at)}
                  </Txt>
                </View>
              </Press>
            ))}
            <Button
              label="Tümünü gör"
              kind="soft"
              size="sm"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => {
                setOpen(false);
                router.navigate('/bildirimler');
              }}
            />
          </Box>
        </Animated.View>
      )}
    </View>
  );
}

function BackButton({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Press
      onPress={() => (router.canGoBack() ? router.back() : router.navigate('/akis'))}
      bg="surface"
      hoverBg="hover"
      shadow
      style={{
        alignSelf: 'flex-start',
        borderRadius: 999,
        paddingVertical: 9,
        paddingLeft: 10,
        paddingRight: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <Icon name="back" size={18} color={colors.text} strokeWidth={2} />
      <Txt size={14} weight={600}>
        {label}
      </Txt>
    </Press>
  );
}
