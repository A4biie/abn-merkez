// Launcher penceresinin çerçevesi: kendi başlık çubuğu, 88 px sol menü, 34 px durum çubuğu.

import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/auth';
import { useConnection } from '@/lib/connection';
import { useLauncherVersion, useMaximized, windowAction } from '@/lib/desktop';
import { AVAILABILITY } from '@/lib/labels';
import { useGameState } from '@/lib/launcher/games';
import { openMerkez } from '@/lib/launcher/merkez';
import { APP_VERSION } from '@/lib/version';
import { EASE_SPRING, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

import { pop2KF } from './parts';

export type LauncherTab = 'ana' | 'oyunlar' | 'indirmeler' | 'ayarlar';

// Tauri sürükleme alanı: data-tauri-drag-region (react-native-web dataSet'i data-* olarak yazar).
const DRAG = { dataSet: { tauriDragRegion: '' } } as object;

export function TitleBar() {
  const { colors } = useTheme();
  const max = useMaximized();
  return (
    <View
      {...DRAG}
      style={{
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 14,
        backgroundColor: colors.nav,
      }}
    >
      <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }}>
        <Logo size={18} />
        <Txt size={13} weight={800}>
          ABN Launcher
        </Txt>
      </View>
      <WinButton icon="minus" label="Küçült" onPress={() => windowAction('minimize')} />
      <WinButton
        icon={max ? 'restore' : 'square'}
        label={max ? 'Önceki boyut' : 'Büyüt'}
        onPress={() => windowAction('toggleMaximize')}
      />
      <WinButton icon="close" label="Kapat (tepsiye indir)" danger onPress={() => windowAction('close')} />
    </View>
  );
}

function WinButton({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  const [hover, setHover] = useState(false);
  // Windows'un kendi kapat butonu gibi: üstüne gelince kırmızı (#C42B1C), ikon beyaz.
  const bg = hover ? (danger ? '#C42B1C' : colors.hover) : 'transparent';
  return (
    <Press
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityLabel={label}
      pressScale={1}
      style={{ width: 46, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}
    >
      <Icon
        name={icon}
        size={icon === 'close' ? 16 : 14}
        color={hover && danger ? '#FFFFFF' : colors.text}
        strokeWidth={1.6}
      />
    </Press>
  );
}

const ITEMS: { tab: LauncherTab; icon: IconName; label: string }[] = [
  { tab: 'ana', icon: 'akis', label: 'Ana sayfa' },
  { tab: 'oyunlar', icon: 'oyun', label: 'Oyunlar' },
  { tab: 'indirmeler', icon: 'download', label: 'İndirmeler' },
  { tab: 'ayarlar', icon: 'ayar', label: 'Ayarlar' },
];

export function Rail({ tab, onTab }: { tab: LauncherTab; onTab: (t: LauncherTab) => void }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const { profile } = useAuth();
  const active = Object.keys(useGameState().downloads).length;

  return (
    <View
      style={{
        width: 88,
        backgroundColor: colors.nav,
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 14,
        gap: 6,
      }}
    >
      {ITEMS.map((it) => {
        const on = it.tab === tab;
        return (
          <Press
            key={it.tab}
            onPress={() => onTab(it.tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={
              it.tab === 'indirmeler' && active ? `${it.label}, ${active} indirme sürüyor` : it.label
            }
            style={{ width: 76, alignItems: 'center', gap: 4, paddingVertical: 6 }}
          >
            <Animated.View
              style={[
                {
                  width: 52,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? colors['nav-pill'] : 'transparent',
                },
                motion.transition(['backgroundColor'], 300),
              ]}
            >
              <Icon
                name={it.icon}
                size={21}
                color={on ? colors['accent-text'] : colors['text-3']}
                strokeWidth={on ? 2.1 : 1.8}
              />
              {it.tab === 'indirmeler' && active > 0 && (
                <Animated.View
                  key={active}
                  style={[
                    {
                      position: 'absolute',
                      top: -2,
                      right: 4,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      paddingHorizontal: 5,
                      backgroundColor: colors.a2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 0 0 2px ${colors.nav}`,
                    },
                    motion.reduced
                      ? null
                      : {
                          animationName: pop2KF,
                          animationDuration: 500,
                          animationTimingFunction: EASE_SPRING,
                        },
                  ]}
                >
                  <Txt size={11} weight={800} color="a2-ink" style={{ fontVariant: ['tabular-nums'] }}>
                    {active}
                  </Txt>
                </Animated.View>
              )}
            </Animated.View>
            <Txt size={11.5} weight={on ? 800 : 600} color={on ? 'text' : 'muted'}>
              {it.label}
            </Txt>
          </Press>
        );
      })}
      <View style={{ flex: 1 }} />
      {profile ? (
        <Press
          onPress={() => openMerkez('/profil')}
          accessibilityLabel={`Profilin: ${profile.full_name}. Merkez'de aç`}
        >
          <Avatar person={profile} size={42} />
          <View
            style={{
              position: 'absolute',
              right: -1,
              bottom: -1,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: AVAILABILITY[profile.availability].color,
              boxShadow: `0 0 0 3px ${colors.nav}`,
            }}
          />
        </Press>
      ) : (
        <Press
          onPress={() => openMerkez('/giris')}
          accessibilityLabel="Merkez'e giriş yap"
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: colors.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="ekip" size={20} color={colors.muted} />
        </Press>
      )}
    </View>
  );
}

export function StatusBar() {
  const { colors } = useTheme();
  const conn = useConnection();
  const launcher = useLauncherVersion();
  const active = Object.keys(useGameState().downloads).length;
  const dot = conn.state === 'online' ? colors.a3 : conn.state === 'reconnecting' ? colors.a1 : colors.faint;
  const label =
    conn.state === 'online'
      ? 'Bağlı'
      : conn.state === 'reconnecting'
        ? 'Yeniden bağlanılıyor…'
        : 'Çevrimdışı';
  return (
    <View
      style={{
        height: 34,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingHorizontal: 16,
        backgroundColor: colors.nav,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      }}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
        accessibilityRole="text"
        accessibilityLabel={`Bağlantı: ${label}`}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
        <Txt size={12} weight={700} color="muted">
          {label}
        </Txt>
      </View>
      <Txt size={12} weight={600} color="faint" style={{ fontVariant: ['tabular-nums'] }}>
        Launcher {launcher ?? '…'} · Merkez {APP_VERSION}
      </Txt>
      <View style={{ flex: 1 }} />
      {active > 0 && (
        <Txt size={12} weight={700} color="text-3">
          {active} indirme sürüyor
        </Txt>
      )}
    </View>
  );
}
