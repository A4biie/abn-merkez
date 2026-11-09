// Uygulamanın zemini (0.8.0): düz bg rengi ve gradyanlı temalarda ekranın tepesinden yayılan "üstten ışık".
// Kökte tek bir tane durur, bütün ekranların arkasında; sayfa kaydıkça yerinde kalır. Gradyanlı
// temalarda sayfaların kendi zemini şeffaftır (Box bg="bg", useTheme().pageBg).
// Tema değişince eski zemin 0.45 sn'de söner.
//
//   CSS:  radial-gradient(130% 55% at 50% -12%, g1 0%, g2 45%, transparent 75%)
//   Telefon: react-native-svg RadialGradient, aynı elips (theme/gradients.ts → GLOW_GEOMETRY).

import { createElement, useEffect, useId, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { GLOW_GEOMETRY, glowCss, splitAlpha } from '@/theme/gradients';
import { css, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { THEMES, type ThemeName } from '@/theme/themes';

const FADE_MS = 450;
const fadeOut = css.keyframes({ from: { opacity: 1 }, to: { opacity: 0 } });

function Layer({ name }: { name: ThemeName }) {
  const t = THEMES[name];
  const glow = t.gradients?.bgGlow;
  if (Platform.OS === 'web') {
    return createElement('div', {
      'aria-hidden': true,
      style: {
        position: 'absolute',
        inset: 0,
        backgroundColor: t.colors.bg,
        backgroundImage: glow ? glowCss(glow) : undefined,
        pointerEvents: 'none',
      },
    });
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.bg }]}>
      {glow && <NativeGlow g1={glow.g1} g2={glow.g2} />}
    </View>
  );
}

function NativeGlow({ g1, g2 }: { g1: string; g2: string }) {
  const { width, height } = useWindowDimensions();
  const id = `glow-${useId().replace(/:/g, '')}`;
  const { cx, cy, rx, ry, stops } = GLOW_GEOMETRY;
  const a = splitAlpha(g1);
  const b = splitAlpha(g2);
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        {/* Birim daire, elipse ölçeklenir: merkez (W/2, -0.12H), yarıçaplar 1.3W ve 0.55H. */}
        <RadialGradient
          id={id}
          cx={0}
          cy={0}
          r={1}
          gradientUnits="userSpaceOnUse"
          gradientTransform={`translate(${width * cx} ${height * cy}) scale(${width * rx} ${height * ry})`}
        >
          <Stop offset={stops[0]} stopColor={a.color} stopOpacity={a.opacity} />
          <Stop offset={stops[1]} stopColor={b.color} stopOpacity={b.opacity} />
          <Stop offset={stops[2]} stopColor={b.color} stopOpacity={0} />
          <Stop offset={1} stopColor={b.color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

export function AppBackground() {
  const { name } = useTheme();
  const motion = useMotion();
  const [shown, setShown] = useState(name);
  const [leaving, setLeaving] = useState<{ name: ThemeName; key: number } | null>(null);

  // Tema değişti: yeni zemin hemen altta, eskisi üstte sönerek kaybolur.
  if (shown !== name) {
    setLeaving(motion.reduced ? null : { name: shown, key: (leaving?.key ?? 0) + 1 });
    setShown(name);
  }

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(null), FADE_MS + 30);
    return () => clearTimeout(t);
  }, [leaving]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Layer name={shown} />
      {leaving && (
        <Animated.View
          key={leaving.key}
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              animationName: fadeOut,
              animationDuration: FADE_MS,
              animationTimingFunction: 'ease',
              animationFillMode: 'both',
            },
          ]}
        >
          <Layer name={leaving.name} />
        </Animated.View>
      )}
    </View>
  );
}
