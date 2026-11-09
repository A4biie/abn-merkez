import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';

import { LOGO_D, LOGO_OUTER } from '@/components/Logo';
import { OUTER_LEN } from '@/components/LogoLoader';
import { Txt } from '@/components/ui/Txt';
import { useConnection } from '@/lib/connection';
import { ease, span } from '@/lib/motion';
import { useTime } from '@/lib/ticker';
import { css, EASE_OUT, EASE_SPRING, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

// "Bağlantı koptu" kapsülü (0.7.0). Kırmızı renk ve titreme yok.
// Aşamalar: düşer (daire) → açılır (318) → [yeniden bağlanılıyor] → bağlandı (a3, 214)
//           → 1.4 sn sonra daireye küçülür → yukarı uçup kaybolur.

type Phase = 'hidden' | 'drop' | 'open' | 'connected' | 'closing' | 'fly';

const CIRCLE = 52;
const LOGO_W = 30;
/** Yarımların kayabilmesi için logo kutusu iki yana genişletildi. */
const VIEWBOX = '80 150 840 700';
const VIEW_W = 840;
const VIEW_H = 700;

const dropIn = css.keyframes({
  from: { transform: [{ translateY: -90 }] },
  to: { transform: [{ translateY: 0 }] },
});
const flyAway = css.keyframes({
  from: { opacity: 1, transform: [{ translateY: 0 }] },
  to: { opacity: 0, transform: [{ translateY: -90 }] },
});
const logoPop = css.keyframes({
  '0%': { transform: [{ scale: 1 }] },
  '50%': { transform: [{ scale: 1.25 }] },
  '100%': { transform: [{ scale: 1 }] },
});

/** Yarımlar arasındaki mesafe ve açı: aşama değişince saat sıfırdan sayar (key ile). */
function SplitLogo(props: { phase: Phase; reconnecting: boolean; color: string; accent: string }) {
  return (
    <SplitLogoInner
      key={`${props.phase === 'drop' ? 'open' : props.phase}:${props.reconnecting}`}
      {...props}
    />
  );
}

function SplitLogoInner({
  phase,
  reconnecting,
  color,
  accent,
}: {
  phase: Phase;
  reconnecting: boolean;
  color: string;
  accent: string;
}) {
  const motion = useMotion();
  const t = useTime(!motion.reduced);
  const joined = phase === 'connected' || phase === 'closing' || phase === 'fly';

  let d = 70;
  if (joined) {
    // Kenetlenme: yay eğrisiyle 0.45 sn'de.
    d = 26 * (1 - (motion.reduced ? 1 : ease.spring(span(t, 0, 450))));
  } else if (reconnecting) {
    // Yeniden bağlanırken yarımlar 1.2 sn'de 26 birime yaklaşır.
    d = 70 - 44 * (motion.reduced ? 1 : ease.io(span(t, 0, 1200)));
  }
  const r = (8 * d) / 70;

  const blink = !joined && !reconnecting ? (Math.sin((t / 1100) * Math.PI * 2) + 1) / 2 : 0;
  const seg = OUTER_LEN * 0.2;
  const spin = reconnecting && !joined ? -OUTER_LEN * ((t % 1000) / 1000) : null;

  const half = (side: 'l' | 'r') => {
    const dx = side === 'l' ? -d : d;
    const rot = side === 'l' ? -r : r;
    return (
      <G clipPath={`url(#cap-${side})`}>
        <G transform={`translate(${dx.toFixed(2)} 0) rotate(${rot.toFixed(2)} 500 500)`}>
          <Path d={LOGO_D} fill={color} fillRule="evenodd" />
          {spin !== null && (
            <Path
              d={LOGO_OUTER}
              fill="none"
              stroke={accent}
              strokeWidth={34}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[seg, OUTER_LEN - seg]}
              strokeDashoffset={spin}
            />
          )}
        </G>
      </G>
    );
  };

  return (
    <Svg
      width={LOGO_W * (VIEW_W / 680)}
      height={LOGO_W * (VIEW_W / 680) * (VIEW_H / VIEW_W)}
      viewBox={VIEWBOX}
    >
      <Defs>
        <ClipPath id="cap-l">
          <Rect x={0} y={0} width={500} height={1000} />
        </ClipPath>
        <ClipPath id="cap-r">
          <Rect x={500} y={0} width={1000} height={1000} />
        </ClipPath>
      </Defs>
      {half('l')}
      {half('r')}
      {blink > 0 && (
        <Line
          x1={500}
          y1={200}
          x2={500}
          y2={800}
          stroke={color}
          strokeWidth={14}
          strokeDasharray={[36, 30]}
          opacity={blink}
        />
      )}
    </Svg>
  );
}

/** Üstte ortalanmış bağlantı kapsülü. Bağlantı yokken sayfa soluk ve gri olur (bkz. AppLayout). */
export function ConnectionCapsule() {
  const { colors } = useTheme();
  const motion = useMotion();
  const insets = useSafeAreaInsets();
  const conn = useConnection();
  const [phase, setPhase] = useState<Phase>('hidden');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Aşamalar zamanlayıcıyla ilerler. Hiç kopmadıysa (gizliyken) bağlanma bir şey göstermez.
  useEffect(() => {
    const at = (ms: number, next: (p: Phase) => Phase) => timers.current.push(setTimeout(() => setPhase(next), ms));
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (conn.state !== 'online') {
      at(0, (p) => (p === 'open' ? 'open' : 'drop'));
      at(motion.reduced ? 0 : 350, () => 'open');
    } else {
      const shown = (next: Phase) => (p: Phase) => (p === 'hidden' ? 'hidden' : next);
      at(0, shown('connected'));
      at(1400, shown('closing'));
      at(1400 + (motion.reduced ? 0 : 350), shown('fly'));
      at(1400 + (motion.reduced ? 0 : 900), () => 'hidden');
    }
    return () => timers.current.forEach(clearTimeout);
  }, [conn.state, motion.reduced]);

  if (phase === 'hidden') return null;

  const connected = phase === 'connected';
  const wide = phase === 'open' ? 318 : connected ? 214 : CIRCLE;
  const bg = connected || phase === 'closing' || phase === 'fly' ? colors.a3 : colors['sel-bg'];
  const fg = connected || phase === 'closing' || phase === 'fly' ? colors['a3-ink'] : colors['sel-fg'];
  const reconnecting = conn.state === 'reconnecting';
  const title = connected ? 'Tekrar bağlandın' : reconnecting ? 'Yeniden bağlanılıyor…' : 'Bağlantı koptu';
  const sub = connected
    ? conn.lastSent > 0
      ? `${conn.lastSent} mesaj gönderildi`
      : 'Her şey güncel'
    : 'Yazdıkların bekliyor, gelince gönderilir.';

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 10 + insets.top,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 90,
      }}
    >
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${title}. ${sub}`}
        style={[
          {
            width: wide,
            height: CIRCLE,
            borderRadius: CIRCLE / 2,
            backgroundColor: bg,
            flexDirection: 'row',
            alignItems: 'center',
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          },
          motion.reduced ? null : motion.transition(['width', 'backgroundColor'], 450, EASE_OUT),
          motion.reduced
            ? null
            : phase === 'drop'
              ? {
                  animationName: dropIn,
                  animationDuration: 600,
                  animationTimingFunction: EASE_SPRING,
                  animationFillMode: 'both',
                }
              : phase === 'fly'
                ? {
                    animationName: flyAway,
                    animationDuration: 500,
                    animationTimingFunction: EASE_OUT,
                    animationFillMode: 'both',
                  }
                : null,
        ]}
      >
        <Animated.View
          key={connected ? 'pop' : 'idle'}
          style={[
            { width: CIRCLE, height: CIRCLE, alignItems: 'center', justifyContent: 'center' },
            connected && !motion.reduced
              ? {
                  animationName: logoPop,
                  animationDuration: 450,
                  animationDelay: 300,
                  animationTimingFunction: EASE_SPRING,
                }
              : null,
          ]}
        >
          <SplitLogo phase={phase} reconnecting={reconnecting} color={fg} accent={colors.a1} />
        </Animated.View>
        {(phase === 'open' || connected) && (
          <View style={{ flex: 1, minWidth: 0, paddingRight: 18 }}>
            <Txt size={14} weight={800} numberOfLines={1} style={{ color: fg }}>
              {title}
            </Txt>
            <Txt size={12} numberOfLines={1} style={{ color: fg, opacity: 0.75 }}>
              {sub}
            </Txt>
          </View>
        )}
      </Animated.View>
    </View>
  );
}
