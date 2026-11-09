import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type Insets,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { EASE_OUT, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import type { Token } from '@/theme/themes';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  bg?: Token;
  /** Fareyle üstüne gelince zemin (.hov). Sadece webde anlamlı. */
  hoverBg?: Token;
  border?: Token;
  shadow?: boolean;
  /** Basınca küçülme oranı. Prototipte telefonda .95, bilgisayarda .97. */
  pressScale?: number;
  style?: StyleProp<ViewStyle>;
};

const MIN_TARGET = 44;

/** Görünen boyutu 44 px'ten küçük butonların dokunma alanı görünmez kenar payıyla 44'e tamamlanır. */
function targetSlop(style: StyleProp<ViewStyle>): Insets | undefined {
  const { width, height } = StyleSheet.flatten(style) ?? {};
  const pad = (v: unknown) => (typeof v === 'number' && v < MIN_TARGET ? Math.ceil((MIN_TARGET - v) / 2) : 0);
  const x = pad(width);
  const y = pad(height);
  return x || y ? { left: x, right: x, top: y, bottom: y } : undefined;
}

/** Basınca hafifçe küçülen buton (.app button:active { transform: scale(.95) }). */
export function Press({ bg, hoverBg, border, shadow, pressScale = 0.95, style, disabled, ...rest }: Props) {
  const { colors } = useTheme();
  const motion = useMotion();
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const fill = hovered && hoverBg && !disabled ? hoverBg : bg;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={targetSlop(style)}
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        rest.onPressOut?.(e);
      }}
      onHoverIn={(e) => {
        setHovered(true);
        rest.onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        setHovered(false);
        rest.onHoverOut?.(e);
      }}
      style={[
        fill && { backgroundColor: colors[fill] },
        border && { borderColor: colors[border], borderWidth: 1 },
        shadow && { boxShadow: colors.shadow },
        { transform: [{ scale: pressed && !disabled ? pressScale : 1 }] },
        motion.reduced
          ? null
          : {
              transitionProperty: ['transform', 'backgroundColor', 'borderColor'],
              transitionDuration: [pressed ? 80 : 200, 450, 450],
              transitionTimingFunction: [EASE_OUT, 'ease', 'ease'],
            },
        { cursor: disabled ? 'auto' : 'pointer' },
        style,
      ]}
    />
  );
}
