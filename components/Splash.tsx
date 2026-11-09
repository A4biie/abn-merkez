import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { LOGO_D, LOGO_HOLES, LOGO_OUTER, LOGO_VIEWBOX } from '@/components/Logo';
import { Txt } from '@/components/ui/Txt';
import { bezier, ease, span } from '@/lib/motion';
import { APP_VERSION } from '@/lib/version';
import { fontFamily } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

// Açılış animasyonu (0.7.0). Zamanlama ms cinsinden, başlangıçtan itibaren:
//   0–1000 dış hat çizilir · 350–1340 altı boşluk sırayla çizilir · 1000–1600 logo alttan dolar
//   1350–1700 konturlar söner · 1550–2050 nabız · 1450–2650 halka · 1350–2050 başlık · 1600–2200 alt yazı
//   400–900 çubuk ve mesaj belirir · 300–2500 çubuk dolar · 2850–3400 ekran kapanır.
// Veri 2850'ye kadar hazır değilse çubuk %90'da bekler, veri gelince kapanış oynar.
// SVG özellikleri (çizgi, maske) JS'te saatten hesaplanır: webde Reanimated SVG özelliği güncelleyemiyor.

const HOLD_AT = 2850;
const END = 3400;
const LOGO_W = 150;
const LOGO_H = 146;
const STROKE = 9;
/** Veri hiç gelmezse (ağ yok) en fazla bu kadar beklenir; uygulama kendi yükleniyor ekranını gösterir. */
const MAX_WAIT = 9000;

const fillEase = bezier(0.7, 0, 0.2, 1);

function perimeter(d: string) {
  const pts = [...d.matchAll(/(\d+) (\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    len += Math.hypot(x2 - x1, y2 - y1);
  }
  return len;
}
const OUTER_LEN = perimeter(LOGO_OUTER);
const HOLE_LENS = LOGO_HOLES.map(perimeter);
/** Boşlukların başlangıçları: 350 ms'den itibaren 78 ms arayla, her biri 600 ms. */
const HOLE_START = LOGO_HOLES.map((_, i) => 350 + i * 78);

export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const clock = useSharedValue(0);
  const dataReady = useSharedValue(false);
  const [t, setT] = useState(reduced ? END - 1 : 0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), MAX_WAIT);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    dataReady.set(ready || timedOut);
  }, [ready, timedOut, dataReady]);

  // "Hareketi azalt": her şey son haliyle görünür, 0.8 sn sonra (veri hazırsa) animasyonsuz kapanır.
  useEffect(() => {
    if (!reduced || !(ready || timedOut)) return;
    const id = setTimeout(onDone, 800);
    return () => clearTimeout(id);
  }, [reduced, ready, timedOut, onDone]);

  // Saat gerçek zamandan hesaplanır (kare atlansa da animasyon yavaşlamaz). Veri beklenen süre
  // (HOLD_AT'te durulan süre) toplamdan düşülür.
  const startedAt = useSharedValue(-1);
  const holdSince = useSharedValue(-1);
  const heldFor = useSharedValue(0);
  const frame = useFrameCallback((f) => {
    'worklet';
    if (clock.get() >= END) return;
    if (startedAt.get() < 0) startedAt.set(f.timestamp);
    if (holdSince.get() >= 0) {
      if (!dataReady.get()) return;
      heldFor.set(heldFor.get() + f.timestamp - holdSince.get());
      holdSince.set(-1);
    }
    const next = f.timestamp - startedAt.get() - heldFor.get();
    // Veri gelmediyse kapanıştan önce bekle (çubuk %90'da durur).
    if (next >= HOLD_AT && !dataReady.get()) {
      holdSince.set(f.timestamp);
      clock.set(HOLD_AT);
      return;
    }
    if (next >= END) {
      clock.set(END);
      scheduleOnRN(onDone);
      return;
    }
    clock.set(next);
  }, !reduced);

  useEffect(() => {
    if (reduced) frame.setActive(false);
  }, [reduced, frame]);

  // SVG için saatin ~60 fps kopyası.
  useAnimatedReaction(
    () => Math.round(clock.get() / 16),
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setT, v * 16);
    },
  );

  const logoStyle = useAnimatedStyle(() => {
    const p = span(clock.get(), 1550, 2050);
    return { transform: [{ scale: 1 + 0.05 * Math.sin(Math.PI * p) }] };
  });
  const ringStyle = useAnimatedStyle(() => {
    const p = span(clock.get(), 1450, 2650);
    const e = ease.out(p);
    return {
      opacity: p <= 0 ? 0 : 0.55 * (1 - p),
      transform: [{ scale: 0.1 + 0.9 * e }],
    };
  });
  const titleStyle = useAnimatedStyle(() => {
    const e = ease.out(span(clock.get(), 1350, 2050));
    return {
      opacity: e,
      transform: [{ translateY: 14 * (1 - e) }],
      letterSpacing: 32 * (0.12 + (-0.015 - 0.12) * e),
    };
  });
  const subStyle = useAnimatedStyle(() => {
    const e = ease.out(span(clock.get(), 1600, 2200));
    return { opacity: e, transform: [{ translateY: 6 * (1 - e) }] };
  });
  const barStyle = useAnimatedStyle(() => ({ opacity: ease.out(span(clock.get(), 400, 900)) }));
  const exitStyle = useAnimatedStyle(() => {
    const e = ease.out(span(clock.get(), HOLD_AT, END));
    const base = { opacity: 1 - e, transform: [{ scale: 1 + 0.05 * e }] };
    return Platform.OS === 'web' ? { ...base, filter: `blur(${(6 * e).toFixed(2)}px)` } : base;
  });

  // SVG değerleri
  const outlineP = ease.io(span(t, 0, 1000));
  const fillP = fillEase(span(t, 1000, 1600));
  const strokeOpacity = 1 - span(t, 1350, 1700);
  const barP = span(t, 300, 2500);
  const bar = ready || timedOut ? barP : Math.min(barP, 0.9);

  const top = 183;
  const bottom = 818;
  const revealH = (bottom - top + STROKE) * fillP;

  const stroke = {
    stroke: colors.text,
    strokeWidth: STROKE,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
    opacity: strokeOpacity,
  };

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: colors.bg, zIndex: 100 },
        reduced ? null : exitStyle,
      ]}
      accessibilityLabel="ABN Merkez açılıyor"
      accessibilityRole="progressbar"
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: LOGO_W, height: LOGO_H }}>
          {!reduced && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: (LOGO_W - 240) / 2,
                  top: (LOGO_H - 240) / 2,
                  width: 240,
                  height: 240,
                  borderRadius: 120,
                  borderWidth: 1.5,
                  borderColor: colors['text-3'],
                },
                ringStyle,
              ]}
            />
          )}
          <Animated.View style={reduced ? null : logoStyle}>
            <Svg width={LOGO_W} height={LOGO_H} viewBox={LOGO_VIEWBOX}>
              <Defs>
                <ClipPath id="splash-reveal">
                  <Rect x={150} y={bottom + STROKE / 2 - revealH} width={700} height={revealH} />
                </ClipPath>
              </Defs>
              {/* Dolu logo: alttan yukarı açılan maskeyle. Boşluklar evenodd ile şeffaf. */}
              <Path
                d={LOGO_D}
                fill={colors.text}
                fillRule="evenodd"
                clipPath={reduced ? undefined : 'url(#splash-reveal)'}
              />
              {!reduced && strokeOpacity > 0 && (
                <>
                  <Path
                    d={LOGO_OUTER}
                    {...stroke}
                    strokeDasharray={[OUTER_LEN, OUTER_LEN]}
                    strokeDashoffset={OUTER_LEN * (1 - outlineP)}
                  />
                  {LOGO_HOLES.map((d, i) => {
                    const p = ease.io(span(t, HOLE_START[i], HOLE_START[i] + 600));
                    return (
                      <Path
                        key={i}
                        d={d}
                        {...stroke}
                        strokeDasharray={[HOLE_LENS[i], HOLE_LENS[i]]}
                        strokeDashoffset={HOLE_LENS[i] * (1 - p)}
                      />
                    );
                  })}
                </>
              )}
            </Svg>
          </Animated.View>
        </View>

        <View style={{ height: 24 }} />
        <Animated.Text
          style={[
            { fontFamily: fontFamily(800), fontSize: 32, color: colors.text, textAlign: 'center' },
            reduced ? { letterSpacing: -0.48 } : titleStyle,
          ]}
        >
          ABN Merkez
        </Animated.Text>
        <Animated.Text
          style={[
            {
              fontFamily: fontFamily(600),
              fontSize: 13,
              letterSpacing: 13 * 0.14,
              color: colors.muted,
              marginTop: 6,
              textAlign: 'center',
            },
            reduced ? null : subStyle,
          ]}
        >
          ABBY&apos;S NEXUS
        </Animated.Text>
      </View>

      <Animated.View
        style={[{ alignItems: 'center', gap: 10, paddingBottom: 18 }, reduced ? null : barStyle]}
      >
        <Svg width={120} height={3}>
          <Defs>
            <LinearGradient id="splash-bar" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.a2} />
              <Stop offset="0.5" stopColor={colors.a1} />
              <Stop offset="1" stopColor={colors.a3} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={120} height={3} rx={1.5} fill={colors.line} />
          <Rect x={0} y={0} width={120 * (reduced ? 1 : bar)} height={3} rx={1.5} fill="url(#splash-bar)" />
        </Svg>
        <Txt size={13} color="faint">
          Ekip toplanıyor…
        </Txt>
      </Animated.View>
      <Txt size={11.5} color="faint" style={{ textAlign: 'center', paddingBottom: 22 }}>
        Sürüm {APP_VERSION}
      </Txt>
    </Animated.View>
  );
}
