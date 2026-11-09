import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { css, EASE_SPRING, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { Txt } from './Txt';

const spin = css.keyframes({
  from: { transform: [{ rotate: '0deg' }] },
  to: { transform: [{ rotate: '360deg' }] },
});
const pop = css.keyframes({
  '0%': { transform: [{ scale: 0.4 }], opacity: 0 },
  '60%': { transform: [{ scale: 1.2 }], opacity: 1 },
  '100%': { transform: [{ scale: 1 }], opacity: 1 },
});

/**
 * Bağlantı yokken yazılanların yanında: dönen saat ve "Bekliyor". Gönderilince a3 renkli tike döner.
 */
export function PendingBadge({ sent, color }: { sent?: boolean; color?: string }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const ink = color ?? colors.muted;
  if (sent) {
    return (
      <Animated.View
        accessibilityLabel="Gönderildi"
        style={[
          {
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.a3,
            alignItems: 'center',
            justifyContent: 'center',
          },
          motion.reduced
            ? null
            : { animationName: pop, animationDuration: 450, animationTimingFunction: EASE_SPRING },
        ]}
      >
        <Icon name="check" size={10} color={colors['a3-ink']} strokeWidth={3.2} />
      </Animated.View>
    );
  }
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      accessibilityLabel="Gönderilmeyi bekliyor"
    >
      <Animated.View
        style={
          motion.reduced
            ? null
            : {
                animationName: spin,
                animationDuration: 2400,
                animationIterationCount: 'infinite',
                animationTimingFunction: 'linear',
              }
        }
      >
        <Icon name="clock" size={13} color={ink} strokeWidth={2} />
      </Animated.View>
      <Txt size={11.5} weight={600} style={{ color: ink }}>
        Bekliyor
      </Txt>
    </View>
  );
}
