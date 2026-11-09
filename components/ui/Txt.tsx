import Animated from 'react-native-reanimated';
import type { TextProps, TextStyle, StyleProp } from 'react-native';

import { fontFamily, type Weight } from '@/theme/fonts';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import type { Token } from '@/theme/themes';

type Props = Omit<TextProps, 'style'> & {
  size?: number;
  weight?: Weight;
  color?: Token;
  /** Satır yüksekliği çarpanı; prototipte gövde 1.45, başlıklar 1.1-1.15. */
  leading?: number;
  style?: StyleProp<TextStyle>;
};

/** Temaya bağlı yazı. Renk tema değişince yumuşakça geçer. */
export function Txt({ size = 15, weight = 400, color = 'text', leading = 1.45, style, ...rest }: Props) {
  const { colors } = useTheme();
  const motion = useMotion();
  return (
    <Animated.Text
      {...rest}
      style={[
        {
          fontFamily: fontFamily(weight),
          fontSize: size,
          lineHeight: Math.round(size * leading),
          color: colors[color],
        },
        motion.colors,
        style,
      ]}
    />
  );
}
