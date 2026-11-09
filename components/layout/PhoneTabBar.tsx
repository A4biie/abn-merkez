import { usePathname } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box } from '@/components/ui/Box';
import { GradientFill, useGradient } from '@/components/ui/Gradient';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Txt } from '@/components/ui/Txt';
import { useChatUnread } from '@/lib/chat';
import { EASE_BOUNCE, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { activeTab, PHONE_TABS } from './nav';

const BAR_HEIGHT = 78;
const PILL_W = 50;

/** Main.dc.html'deki 6 sekmeli alt menü (Fikirler Akış'taki butonda); seçili sekmenin üstünde kayan pill. */
export function PhoneTabBar() {
  const { colors } = useTheme();
  const motion = useMotion();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const unread = useChatUnread();

  const pill = useGradient('pill');
  const current = activeTab(pathname);
  const index = PHONE_TABS.findIndex((t) => t.name === current);
  const cell = width / PHONE_TABS.length;

  return (
    <Box
      bg="nav"
      border="line"
      style={{
        height: BAR_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        borderWidth: 0,
        borderTopWidth: 1,
      }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {index >= 0 && width > 0 && (
        <Animated.View
          aria-hidden
          style={[
            {
              position: 'absolute',
              top: 10,
              left: index * cell + (cell - PILL_W) / 2,
              width: PILL_W,
              height: 32,
              borderRadius: 999,
              backgroundColor: colors['nav-pill'],
              overflow: 'hidden',
            },
            motion.transition(['left', 'backgroundColor'], 500, EASE_BOUNCE),
          ]}
        >
          {/* Aktif sekme: gradyanlı temalarda pillGradient (0.8.0). */}
          {pill && <GradientFill pair={pill} />}
        </Animated.View>
      )}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {PHONE_TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
            <TabButton
              label={t.label}
              icon={t.icon}
              active={current === t.name}
              dot={t.name === 'sohbet' && unread}
            />
          </TabTrigger>
        ))}
      </View>
    </Box>
  );
}

type TabButtonProps = TabTriggerSlotProps & { label: string; icon: IconName; active: boolean; dot?: boolean };

// TabTrigger asChild: onPress ve ref'i bu bileşene verir. Seçili durum adresten gelir (active).
function TabButton({ label, icon, active, dot, isFocused: _isFocused, ...rest }: TabButtonProps) {
  const { colors } = useTheme();
  const color = active ? 'accent-text' : 'faint';
  return (
    <Press
      {...rest}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{ flex: 1, alignItems: 'center', paddingTop: 14, gap: 8 }}
    >
      <View>
        <Icon name={icon} size={22} color={colors[color]} />
        {dot && <UnreadDot />}
      </View>
      <Txt size={12} weight={600} color={color} leading={1.2}>
        {label}
      </Txt>
    </Press>
  );
}

/** Okunmamış mesaj noktası (sayı yok). */
export function UnreadDot() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel="Okunmamış mesaj var"
      style={{
        position: 'absolute',
        top: -2,
        right: -4,
        width: 9,
        height: 9,
        borderRadius: 5,
        backgroundColor: colors['accent-text'],
        borderWidth: 1.5,
        borderColor: colors.nav,
      }}
    />
  );
}
