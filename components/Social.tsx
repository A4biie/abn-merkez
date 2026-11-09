import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import type { Profile } from '@/lib/types';
import { css, EASE_OUT, EASE_SPRING, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

// Kalp: 0.5 sn'lik pop, ölçek 1 → 0.72 → 1.22 → 1, yay eğrisiyle.
const pop = css.keyframes({
  '0%': { transform: [{ scale: 1 }] },
  '30%': { transform: [{ scale: 0.72 }] },
  '65%': { transform: [{ scale: 1.22 }] },
  '100%': { transform: [{ scale: 1 }] },
});

/** 8 küçük kare: kalbin etrafına saçılıp kaybolur (0.65 sn). */
const BURST = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
  const r = 22 + (i % 2) * 6;
  return css.keyframes({
    from: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 1 }] },
    to: {
      opacity: 0,
      transform: [
        { translateX: Math.cos(a) * r },
        { translateY: Math.sin(a) * r },
        { rotate: `${i % 2 ? 90 : -90}deg` },
        { scale: 0.4 },
      ],
    },
  });
});

/** Kalp butonu. Sayı yok; bırakınca pop yapar, etrafına renkli kareler saçılır, telefonda hafif titreşir. */
export function HeartButton({
  liked,
  onPress,
  size = 40,
}: {
  liked: boolean;
  onPress: () => void;
  size?: number;
}) {
  const { colors } = useTheme();
  const motion = useMotion();
  // Saçılma sadece kişinin kendi basışında oynasın (sayfa açılırken dolu gelen kalpte değil).
  const [burst, setBurst] = useState(0);

  function press() {
    if (!liked) {
      setBurst((b) => b + 1);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  }

  const tints = [colors.a1, colors.a2, colors.a3, colors.heart];
  return (
    <Press
      onPress={press}
      bg="surface2"
      accessibilityLabel={liked ? 'Kalbini geri al' : 'Kalp bırak'}
      accessibilityState={{ selected: liked }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {burst > 0 && liked && !motion.reduced && (
        <View key={burst} pointerEvents="none" style={{ position: 'absolute', width: 0, height: 0 }}>
          {BURST.map((kf, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: -3,
                top: -3,
                width: 6,
                height: 6,
                borderRadius: 1.5,
                backgroundColor: tints[i % 4],
                animationName: kf,
                animationDuration: 650,
                animationTimingFunction: EASE_OUT,
                animationFillMode: 'both',
              }}
            />
          ))}
        </View>
      )}
      <Animated.View
        key={liked ? `on-${burst}` : 'off'}
        style={
          liked && burst > 0 && !motion.reduced
            ? { animationName: pop, animationDuration: 500, animationTimingFunction: EASE_SPRING }
            : undefined
        }
      >
        <Icon
          name="heart"
          size={20}
          color={liked ? colors.heart : colors['text-2']}
          fill={liked ? colors.heart : 'none'}
        />
      </Animated.View>
    </Press>
  );
}

type Person = Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'avatar_color'>;

const springIn = css.keyframes({
  from: { opacity: 0, transform: [{ scale: 0.3 }, { translateX: -6 }] },
  to: { opacity: 1, transform: [{ scale: 1 }, { translateX: 0 }] },
});

/** Üst üste binen küçük avatarlar (beğenenler, proje üyeleri). Sonradan eklenen avatar yayla girer. */
export function AvatarStack({
  people,
  size = 24,
  max = 4,
  ring = 'surface',
}: {
  people: Person[];
  size?: number;
  max?: number;
  ring?: 'surface' | 'bg';
}) {
  const { colors } = useTheme();
  const motion = useMotion();
  const overlap = Math.round(size * 0.25);
  // İlk çizimdeki avatarlar animasyonsuz; sonradan gelenler (ör. kendi kalbin) yayla eklenir.
  const [initial] = useState(() => new Set(people.map((p) => p.id)));

  return (
    <View style={{ flexDirection: 'row' }}>
      {people.slice(0, max).map((p) => {
        const fresh = !initial.has(p.id) && !motion.reduced;
        return (
          <Animated.View
            key={p.id}
            style={[
              {
                marginRight: -overlap,
                borderRadius: size / 2 + 2,
                borderWidth: 2,
                borderColor: colors[ring],
              },
              fresh
                ? {
                    animationName: springIn,
                    animationDuration: 500,
                    animationTimingFunction: EASE_SPRING,
                    animationFillMode: 'both',
                  }
                : null,
            ]}
          >
            <Avatar person={p} size={size - 4} />
          </Animated.View>
        );
      })}
    </View>
  );
}
