import Animated from 'react-native-reanimated';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import type { Token } from '@/theme/themes';

import { GradientFill, useGradient, type GradientKind } from './Gradient';

type Props = ViewProps & {
  bg?: Token;
  border?: Token;
  /** Temanın gölgesi (açık temalarda hafif, koyularda yok). */
  shadow?: boolean;
  /** Gradyanlı temalarda zeminin üstüne bu tür gradyan (düz temada yok sayılır). */
  gradient?: GradientKind;
  style?: StyleProp<ViewStyle>;
};

/** Temaya bağlı zemin/çerçeve rengi olan kutu. Renkler tema değişince yumuşakça geçer. */
export function Box({ bg, border, shadow, gradient, style, children, ...rest }: Props) {
  const { colors, theme } = useTheme();
  const motion = useMotion();
  const pair = useGradient(gradient);
  // Gradyanlı temalarda sayfa zemini şeffaf: altındaki AppBackground (düz renk + üstten ışık) görünür.
  const fill = bg === 'bg' && theme.gradients ? 'transparent' : bg ? colors[bg] : undefined;
  return (
    <Animated.View
      {...rest}
      style={[
        fill && { backgroundColor: fill },
        pair && { overflow: 'hidden' },
        border && { borderColor: colors[border], borderWidth: 1 },
        shadow && { boxShadow: colors.shadow },
        motion.colors,
        style,
      ]}
    >
      {pair && <GradientFill pair={pair} />}
      {children}
    </Animated.View>
  );
}
