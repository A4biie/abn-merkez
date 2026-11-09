import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { GRID, MIN_ZOOM, type Camera } from './camera';

/**
 * Kamerayla birlikte kayan noktalı zemin. Desen bir kez çizilir; kamera değişince sadece
 * bu katman kaydırılıp ölçeklenir (React yeniden çizmez). Kaydırma ızgara adımına göre
 * modülo alındığı için katman hiç bitmez.
 */
export function DotGrid({ cam }: { cam: Camera }) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  // En uzak yakınlaştırmada bile ekranı kaplayacak dünya boyu.
  const w = width / MIN_ZOOM + GRID * 2;
  const h = height / MIN_ZOOM + GRID * 2;

  const style = useAnimatedStyle(() => {
    const z = cam.zoom.get();
    const step = GRID * z;
    const ox = (((cam.x.get() % step) + step) % step) - step;
    const oy = (((cam.y.get() % step) + step) % step) - step;
    return { transform: [{ translateX: ox }, { translateY: oy }, { scale: z }] };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, top: 0, width: w, height: h, transformOrigin: 'left top' },
        style,
      ]}
    >
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="abn-dots" x={0} y={0} width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <Circle cx={0} cy={0} r={1.4} fill={colors.dot} />
            <Circle cx={GRID} cy={0} r={1.4} fill={colors.dot} />
            <Circle cx={0} cy={GRID} r={1.4} fill={colors.dot} />
            <Circle cx={GRID} cy={GRID} r={1.4} fill={colors.dot} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill="url(#abn-dots)" />
      </Svg>
    </Animated.View>
  );
}
