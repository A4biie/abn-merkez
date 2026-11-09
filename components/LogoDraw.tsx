import { useReducedMotion } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';

import { LOGO_D, LOGO_HOLES, LOGO_OUTER, LOGO_RATIO, LOGO_VIEWBOX } from '@/components/Logo';
import { OUTER_LEN } from '@/components/LogoLoader';
import { bezier, ease, span } from '@/lib/motion';
import { useTime } from '@/lib/ticker';
import { useTheme } from '@/theme/ThemeProvider';

const fillEase = bezier(0.7, 0, 0.2, 1);
const HOLE_LENS = LOGO_HOLES.map((d) => {
  const pts = [...d.matchAll(/(\d+) (\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  return pts.reduce((sum, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return sum + Math.hypot(q[0] - p[0], q[1] - p[1]);
  }, 0);
});

/**
 * Açılış animasyonunun kısa hali (hoş geldin ekranı): dış hat ve boşluklar çizilir, logo alttan
 * dolar, konturlar söner. Toplam ~1.2 sn.
 */
export function LogoDraw({ size = 72, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const t = useTime(!reduced);
  const ink = color ?? colors.text;
  const T = reduced ? 9999 : t;

  const outline = ease.io(span(T, 0, 600));
  const fill = fillEase(span(T, 550, 950));
  const fade = 1 - span(T, 850, 1150);
  const revealH = 650 * fill;

  return (
    <Svg width={size} height={size * LOGO_RATIO} viewBox={LOGO_VIEWBOX} accessibilityLabel="ABN Merkez">
      <Defs>
        <ClipPath id="draw-reveal">
          <Rect x={150} y={823 - revealH} width={700} height={revealH} />
        </ClipPath>
      </Defs>
      <Path d={LOGO_D} fill={ink} fillRule="evenodd" clipPath="url(#draw-reveal)" />
      {fade > 0 && (
        <>
          <Path
            d={LOGO_OUTER}
            fill="none"
            stroke={ink}
            strokeWidth={14}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={fade}
            strokeDasharray={[OUTER_LEN, OUTER_LEN]}
            strokeDashoffset={OUTER_LEN * (1 - outline)}
          />
          {LOGO_HOLES.map((d, i) => {
            const p = ease.io(span(T, 200 + i * 50, 600 + i * 50));
            return (
              <Path
                key={i}
                d={d}
                fill="none"
                stroke={ink}
                strokeWidth={14}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={fade}
                strokeDasharray={[HOLE_LENS[i], HOLE_LENS[i]]}
                strokeDashoffset={HOLE_LENS[i] * (1 - p)}
              />
            );
          })}
        </>
      )}
    </Svg>
  );
}
