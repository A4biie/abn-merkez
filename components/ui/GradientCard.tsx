// <GradientCard tone="a1|a2"> ve <GradientButton> (0.8.0). Düz temalarda düz a1/a2 renginde.

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { Box } from './Box';

/** a1 kart → taskGradient (görev kartları), a2 kart → annGradient (duyurular, sabitlenmiş içerik). */
export function GradientCard({
  tone,
  children,
  style,
}: {
  tone: 'a1' | 'a2';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Box bg={tone} gradient={tone === 'a1' ? 'task' : 'ann'} style={style}>
      {children}
    </Box>
  );
}

/** Ana buton: btnGradient ve üst kenar parıltısı (Button kind="primary" ile aynı). */
export { GradientButton } from './Controls';
