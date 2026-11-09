import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Box } from '@/components/ui/Box';
import { Press } from '@/components/ui/Press';
import { Txt } from '@/components/ui/Txt';
import { ease, span } from '@/lib/motion';
import { useTime } from '@/lib/ticker';
import { css, EASE_OUT, EASE_SPRING, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

const CHECK = 'M5 12.5 10 17.5 19 7';
const CHECK_LEN = 21;

/** Onay kutusu a1 ile dolar ve tik çizilir. */
export function DoneCheck({ size = 26 }: { size?: number }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const t = useTime(!motion.reduced);
  const fill = motion.reduced ? 1 : ease.out(span(t, 0, 250));
  const tick = motion.reduced ? 1 : ease.out(span(t, 150, 550));
  return (
    <View
      accessibilityLabel="Görev bitti"
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: colors.a1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          backgroundColor: colors.a1,
          transform: [{ scale: fill }],
          borderRadius: 6,
        }}
      />
      <Svg width={size - 6} height={size - 6} viewBox="0 0 24 24">
        <Path
          d={CHECK}
          fill="none"
          stroke={colors['a1-ink']}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[CHECK_LEN, CHECK_LEN]}
          strokeDashoffset={CHECK_LEN * (1 - tick)}
        />
      </Svg>
    </View>
  );
}

export const statusPop = css.keyframes({
  '0%': { transform: [{ scale: 1 }] },
  '35%': { transform: [{ scale: 1.25 }] },
  '100%': { transform: [{ scale: 1 }] },
});

/** 14 parça konfeti: kartın içinden yükselip kaybolur (1 sn). */
const PIECES = Array.from({ length: 14 }, (_, i) => {
  const x = ((i * 37) % 100) - 50;
  const drift = ((i * 53) % 40) - 20;
  const rise = 70 + ((i * 29) % 60);
  return {
    left: `${50 + x * 0.9}%` as const,
    kf: css.keyframes({
      from: { opacity: 1, transform: [{ translateY: 0 }, { translateX: 0 }, { rotate: '0deg' }] },
      to: {
        opacity: 0,
        transform: [{ translateY: -rise }, { translateX: drift }, { rotate: `${i % 2 ? 160 : -160}deg` }],
      },
    }),
    delay: (i % 5) * 30,
  };
});

export function Confetti() {
  const { colors } = useTheme();
  const motion = useMotion();
  if (motion.reduced) return null;
  const tints = [colors.a1, colors.a2, colors.a3];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 18, height: 0 }}>
      {PIECES.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.left,
            width: i % 3 === 0 ? 8 : 6,
            height: i % 3 === 0 ? 4 : 6,
            borderRadius: 1.5,
            backgroundColor: tints[i % 3],
            animationName: p.kf,
            animationDuration: 1000,
            animationDelay: p.delay,
            animationTimingFunction: EASE_OUT,
            animationFillMode: 'both',
          }}
        />
      ))}
    </View>
  );
}

const rise = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 8 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
});

/** Kartın altında beliren teşekkür satırı; "paylaşım" kısmına basınca paylaşım paneli açılır. */
export function DoneNote({ onShare }: { onShare: () => void }) {
  const motion = useMotion();
  return (
    <Animated.View
      style={
        motion.reduced
          ? null
          : {
              animationName: rise,
              animationDuration: 450,
              animationDelay: 350,
              animationTimingFunction: EASE_SPRING,
              animationFillMode: 'both',
            }
      }
    >
      <Box bg="surface2" style={{ borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 }}>
        <Txt size={13.5}>
          Eline sağlık!{' '}
          <Press onPress={onShare} accessibilityRole="link" style={{ minHeight: 0 }}>
            <Txt size={13.5} weight={700} color="accent-text">
              Bir paylaşımla gösterir misin?
            </Txt>
          </Press>
        </Txt>
      </Box>
    </Animated.View>
  );
}
