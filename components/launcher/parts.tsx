// Launcher'ın ortak parçaları. Keyframe değerleri design/abn-animasyonlar.html'den birebir.

import { useId } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';

import { Txt } from '@/components/ui/Txt';
import { css, EASE_IO, EASE_OUT, EASE_SPRING, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

/** @keyframes rise — alttan yerine oturma (.45s var(--out)). */
export const riseKF = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 16 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
});
/** @keyframes ufIn — dosya kartı yukarıdan hafif eğik düşer (.55s var(--spring)). */
export const ufInKF = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: -18 }, { rotate: '-2deg' }, { scale: 0.94 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { rotate: '0deg' }, { scale: 1 }] },
});
/** @keyframes pop2 — onay rozeti zıplar (.5s var(--spring)). */
export const pop2KF = css.keyframes({
  '0%': { transform: [{ scale: 0 }] },
  '60%': { transform: [{ scale: 1.2 }] },
  '100%': { transform: [{ scale: 1 }] },
});
/** @keyframes lwBusy — logonun hafif nabzı (2.2s ease-in-out, sonsuz). */
export const lwBusyKF = css.keyframes({
  '0%': { transform: [{ scale: 1 }] },
  '12%': { transform: [{ scale: 1.045 }] },
  '24%': { transform: [{ scale: 1 }] },
  '100%': { transform: [{ scale: 1 }] },
});
/** @keyframes bobP — boş ekrandaki parçaların salınımı (3.6s ease-in-out, sonsuz). */
export const bobKF = css.keyframes({
  '0%': { transform: [{ translateY: 0 }, { rotate: '0deg' }] },
  '50%': { transform: [{ translateY: -22 }, { rotate: '6deg' }] },
  '100%': { transform: [{ translateY: 0 }, { rotate: '0deg' }] },
});
/** @keyframes sweep — ilerleme çubuğunun üstünden geçen ışık (1.1s ease-in-out, sonsuz). */
const sweepKF = css.keyframes({
  from: { transform: [{ translateX: '-100%' }] },
  to: { transform: [{ translateX: '100%' }] },
});

/** Sahne zemini: noktalı desen (radial-gradient(var(--dot) 1.2px) 18px ızgara). */
export function Dots({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  const id = useId().replace(/:/g, '');
  return (
    <Svg style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Defs>
        <Pattern id={`dots-${id}`} x={0} y={0} width={18} height={18} patternUnits="userSpaceOnUse">
          <Circle cx={9} cy={9} r={1.2} fill={colors.dot} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#dots-${id})`} />
    </Svg>
  );
}

/** Üç renkli (a2 → a1 → a3) ilerleme çubuğu; ilerlerken üstünden ışık geçer. */
export function GradientBar({
  progress,
  height = 5,
  track = 'surface2',
  sweep = true,
}: {
  progress: number;
  height?: number;
  track?: 'surface2' | 'line-2';
  sweep?: boolean;
}) {
  const { colors } = useTheme();
  const motion = useMotion();
  const id = useId().replace(/:/g, '');
  const p = Math.max(0, Math.min(100, progress));
  return (
    <View
      style={{ height, borderRadius: height, backgroundColor: colors[track], overflow: 'hidden' }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p) }}
    >
      <Animated.View
        style={[
          { width: `${p}%`, height: '100%', borderRadius: height, overflow: 'hidden' },
          motion.reduced ? null : motion.transition(['width'], 160, 'linear'),
        ]}
      >
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`gb-${id}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.a2} />
              <Stop offset="0.5" stopColor={colors.a1} />
              <Stop offset="1" stopColor={colors.a3} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#gb-${id})`} />
        </Svg>
        {sweep && !motion.reduced && p > 0 && p < 100 && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                animationName: sweepKF,
                animationDuration: 1100,
                animationTimingFunction: EASE_IO,
                animationIterationCount: 'infinite',
              },
            ]}
          >
            <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
              <Defs>
                <LinearGradient id={`sw-${id}`} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                  <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.55} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#sw-${id})`} />
            </Svg>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

/** Yuvarlak küçük etiket (durum etiketi, sürüm çipi). */
export function Tag({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 10,
        alignSelf: 'flex-start',
      }}
    >
      <Txt size={12} weight={800} style={{ color: fg }}>
        {label}
      </Txt>
    </View>
  );
}

/** Bir öğenin alttan sırayla girişi (rise, 60 ms ara). */
export function riseIn(motion: ReturnType<typeof useMotion>, index = 0) {
  if (motion.reduced) return null;
  return {
    animationName: riseKF,
    animationDuration: 450,
    animationDelay: Math.min(index, 8) * 60,
    animationTimingFunction: EASE_OUT,
    animationFillMode: 'both' as const,
  };
}

export { EASE_SPRING };
