import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

// ABN logosu: dış hat ve içindeki 6 boşluk, evenodd kuralıyla tek bir path.
// Açılış animasyonu, yükleniyor işareti ve boş ekranlar bu parçaları ayrı ayrı kullanır.

export const LOGO_VIEWBOX = '160 170 680 662';
/** viewBox oranı (yükseklik / genişlik). */
export const LOGO_RATIO = 662 / 680;

export const LOGO_OUTER =
  'M174 263 L260 263 L334 334 L500 183 L666 334 L740 263 L826 263 L826 690 L760 627 L760 565 L500 818 L240 565 L240 627 L174 690 Z';

/** İçteki 6 boşluk, sırasıyla 1–6. */
export const LOGO_HOLES = [
  'M236 328 L286 377 L236 427 Z',
  'M764 328 L714 377 L764 427 Z',
  'M475 301 L475 470 L385 383 Z',
  'M525 301 L615 383 L525 470 Z',
  'M336 427 L476 564 L476 705 L260 497 Z',
  'M664 427 L740 497 L524 705 L524 564 Z',
] as const;

/** Tam logo: dış hat + 6 boşluk (fillRule evenodd ile boşluklar şeffaf kalır). */
export const LOGO_D = [LOGO_OUTER, ...LOGO_HOLES].join(' ');

/** Logo; size genişliktir, yükseklik orana göre. Renk verilmezse temanın yazı rengi. */
export function Logo({ size = 44, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size * LOGO_RATIO} viewBox={LOGO_VIEWBOX} aria-hidden>
      <Path d={LOGO_D} fill={color ?? colors.text} fillRule="evenodd" />
    </Svg>
  );
}

/** Uygulamadaki marka işareti: sel-bg renginde daire, içinde sel-fg renginde logo. */
export function LogoBadge({ size = 44 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="ABN Merkez"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors['sel-bg'],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Logo size={size * 0.58} color={colors['sel-fg']} />
    </View>
  );
}
