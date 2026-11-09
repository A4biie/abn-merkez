import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { LOGO_D, LOGO_OUTER, LOGO_RATIO, LOGO_VIEWBOX } from '@/components/Logo';
import { useTime } from '@/lib/ticker';
import { useTheme } from '@/theme/ThemeProvider';

/** Dış hattın uzunluğu (viewBox biriminde). */
export const OUTER_LEN = (() => {
  const pts = [...LOGO_OUTER.matchAll(/(\d+) (\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    len += Math.hypot(x2 - x1, y2 - y1);
  }
  return len;
})();

const SIZES = { sm: 22, md: 38, lg: 64 } as const;
const WIDTHS = { sm: 40, md: 30, lg: 22 } as const;
const LAP = 1300;

/**
 * Yükleniyor işareti: logo silueti %13 opaklıkta, dış hattın üstünde boyunun %20'si kadar renkli
 * bir çizgi sabit hızla tur atar (1.3 sn). Renk her turda a1 → a2 → a3.
 * Boyutlar: sm 22 (buton), md 38 (liste), lg 64 (sayfa).
 * progress verilirse çizgi dönmez, dış hat o oranda çizilir (aşağı çekip yenile).
 */
export function LogoLoader({
  size = 'md',
  color,
  progress,
  label = 'Yükleniyor',
}: {
  size?: keyof typeof SIZES;
  /** Çizginin rengi sabit olsun (ör. buton içinde a1-ink). */
  color?: string;
  progress?: number;
  label?: string;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const spinning = progress === undefined && !reduced;
  const t = useTime(spinning);
  const px = SIZES[size];
  const lap = Math.floor(t / LAP);
  const phase = (t % LAP) / LAP;
  const tint = color ?? [colors.a1, colors.a2, colors.a3][lap % 3];
  const seg = OUTER_LEN * 0.2;

  return (
    <Svg
      width={px}
      height={px * LOGO_RATIO}
      viewBox={LOGO_VIEWBOX}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <Path d={LOGO_D} fill={color ?? colors.text} fillRule="evenodd" opacity={0.13} />
      {progress !== undefined ? (
        <Path
          d={LOGO_OUTER}
          fill="none"
          stroke={tint}
          strokeWidth={WIDTHS[size]}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[OUTER_LEN, OUTER_LEN]}
          strokeDashoffset={OUTER_LEN * (1 - Math.max(0, Math.min(1, progress)))}
        />
      ) : (
        <Path
          d={LOGO_OUTER}
          fill="none"
          stroke={tint}
          strokeWidth={WIDTHS[size]}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={[seg, OUTER_LEN - seg]}
          strokeDashoffset={-OUTER_LEN * (reduced ? 0 : phase)}
        />
      )}
    </Svg>
  );
}
