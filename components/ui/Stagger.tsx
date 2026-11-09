import { Children, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { useMotion } from '@/theme/motion';

type Props = {
  children: ReactNode;
  /** 'enter' aşağıdan belirir (.stagger), 'push' sağdan gelir (.pushin). */
  kind?: 'enter' | 'push';
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

/** Çocuklarını sırayla belirtir. Hareketi azalt açıksa hepsi doğrudan görünür. */
export function Stagger({ children, kind = 'enter', gap = 0, style }: Props) {
  const motion = useMotion();
  const items = Children.toArray(children).filter(Boolean);
  return (
    <Animated.View style={[{ gap }, style]}>
      {items.map((child, i) => (
        <Animated.View key={i} style={kind === 'push' ? motion.push(i) : motion.enter(i)}>
          {child}
        </Animated.View>
      ))}
    </Animated.View>
  );
}
