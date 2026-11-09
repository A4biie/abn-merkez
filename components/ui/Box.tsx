import Animated from 'react-native-reanimated';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import type { Token } from '@/theme/themes';

type Props = ViewProps & {
  bg?: Token;
  border?: Token;
  /** Temanın gölgesi (açık temalarda hafif, koyularda yok). */
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Temaya bağlı zemin/çerçeve rengi olan kutu. Renkler tema değişince yumuşakça geçer. */
export function Box({ bg, border, shadow, style, ...rest }: Props) {
  const { colors } = useTheme();
  const motion = useMotion();
  return (
    <Animated.View
      {...rest}
      style={[
        bg && { backgroundColor: colors[bg] },
        border && { borderColor: colors[border], borderWidth: 1 },
        shadow && { boxShadow: colors.shadow },
        motion.colors,
        style,
      ]}
    />
  );
}
