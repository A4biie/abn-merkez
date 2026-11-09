import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { paint } from '@/components/ui/Controls';
import { BANNER } from '@/lib/labels';
import type { BannerColor } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';

/** Profil afişi: yüklenmiş görsel ya da renk + prototipteki üçgen deseni. */
export function Banner({
  color,
  url,
  height,
  radius = 0,
  children,
}: {
  color: BannerColor;
  url: string | null;
  height: number;
  radius?: number;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const b = BANNER[color];
  const ink = paint(colors, b.ink);
  return (
    <View style={{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: paint(colors, b.bg) }}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel="Profil afişi" />
      ) : (
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 390 170"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          stroke={ink}
          strokeWidth={2}
          opacity={0.22}
          style={{ position: 'absolute' }}
        >
          <Path d="M30 160 85 62 140 160Z" />
          <Path d="M196 128 258 20 320 128Z" />
          <Path d="M300 180 342 106 384 180Z" />
          <Path d="M118 46 150 -10 182 46Z" />
          <Circle cx={252} cy={150} r={14} />
          <Circle cx={62} cy={30} r={8} />
          <Circle cx={358} cy={40} r={5} />
        </Svg>
      )}
      {children}
    </View>
  );
}
