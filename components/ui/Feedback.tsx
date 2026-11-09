import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { css, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card } from './Controls';
import { Txt } from './Txt';

// Parıltı bandı bloğun solundan sağına 1.6 sn'de bir geçer.
const sweep = css.keyframes({
  from: { transform: [{ translateX: '-100%' }] },
  to: { transform: [{ translateX: '100%' }] },
});

/** Yüklenirken içeriğin yerinde duran blok: surface2 zemin, üstünden a2'nin %22'si kadar soluk parıltı. */
export function Bone({
  w = '100%',
  h = 14,
  r = 8,
}: {
  w?: DimensionValue;
  h?: number;
  r?: number;
}) {
  const { colors } = useTheme();
  const motion = useMotion();
  return (
    <View style={{ width: w, height: h, borderRadius: r, backgroundColor: colors.surface2, overflow: 'hidden' }}>
      {!motion.reduced && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              animationName: sweep,
              animationDuration: 1600,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
            },
          ]}
        >
          <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 10">
            <Defs>
              <LinearGradient id="bone-shine" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.a2} stopOpacity={0} />
                <Stop offset="0.5" stopColor={colors.a2} stopOpacity={0.22} />
                <Stop offset="1" stopColor={colors.a2} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={100} height={10} fill="url(#bone-shine)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

/** Kart biçiminde iskelet; listeler yüklenirken birkaç tane gösterilir. */
export function SkeletonCards({ count = 3, lines = 3 }: { count?: number; lines?: number }) {
  return (
    <View style={{ gap: 16 }} accessibilityLabel="Yükleniyor" role="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} radius={24}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Bone w={38} h={38} r={19} />
            <View style={{ flex: 1, gap: 6 }}>
              <Bone w="40%" h={12} />
              <Bone w="25%" h={10} />
            </View>
          </View>
          {Array.from({ length: lines }, (_, j) => (
            <Bone key={j} w={j === lines - 1 ? '60%' : '100%'} />
          ))}
        </Card>
      ))}
    </View>
  );
}

/** Veri gelmediyse sakin bir açıklama ve "Tekrar dene". */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card gap={10}>
      <Txt weight={600}>Şu an yüklenemedi</Txt>
      <Txt size={14} color="muted">
        {message}
      </Txt>
      {onRetry && <Button label="Tekrar dene" kind="soft" onPress={onRetry} style={{ alignSelf: 'flex-start' }} />}
    </Card>
  );
}
