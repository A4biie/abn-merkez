// Tema gradyanlarını çizen küçük yardımcılar (0.8.0). Bileşenler gradyanı elle yazmaz:
//   <Box gradient="task"> / <Press gradient="btn">  → zeminin üstüne gradyan katmanı
//   <GradientCard tone="a1|a2">, <GradientButton>     → components/ui/GradientCard.tsx
// Tema düzse (Noir, Zeytin, Adaçayı, Pudra) hiçbiri gradyan çizmez; düz renk kalır.

import { LinearGradient } from 'expo-linear-gradient';
import { createElement, useId, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { GLOW_GEOMETRY, glowCss, LINEAR_135, linearCss, scaleAlpha, splitAlpha } from '@/theme/gradients';
import { useTheme } from '@/theme/ThemeProvider';
import type { GradientPair, ThemeGradients } from '@/theme/themes';

export type GradientKind = 'btn' | 'ann' | 'task' | 'chip' | 'badge' | 'pill';

const KEY: Record<GradientKind, keyof Omit<ThemeGradients, 'bgGlow' | 'highlight' | 'cardShadow'>> = {
  btn: 'btnGradient',
  ann: 'annGradient',
  task: 'taskGradient',
  chip: 'chipGradient',
  badge: 'badgeGradient',
  pill: 'pillGradient',
};

/** Aktif temada bu türün gradyanı; düz temada ya da tür verilmemişse null. */
export function useGradient(kind: GradientKind | undefined | false): GradientPair | null {
  const { theme } = useTheme();
  return kind && theme.gradients ? theme.gradients[KEY[kind]] : null;
}

/** Butonların üst kenarındaki parıltı (gradyanlı temalarda), yoksa undefined. */
export function useHighlight(): string | undefined {
  return useTheme().theme.gradients?.highlight;
}

/**
 * Ebeveyninin tamamını kaplayan "üstten ışık" (tema önizlemesi, bildirim kartı gibi küçük alanlar için).
 * strength: 0.5 = yarı yoğunluk. Webde CSS, telefonda SVG radyal gradyan (boyut ölçülerek).
 */
export function GlowFill({ glow, strength = 1 }: { glow: ThemeGradients['bgGlow']; strength?: number }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const id = `glowfill-${useId().replace(/:/g, '')}`;
  if (Platform.OS === 'web') {
    return createElement('div', {
      'aria-hidden': true,
      style: {
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        backgroundImage: glowCss(glow, strength),
        pointerEvents: 'none',
      },
    });
  }
  const { cx, cy, rx, ry, stops } = GLOW_GEOMETRY;
  const a = splitAlpha(strength === 1 ? glow.g1 : scaleAlpha(glow.g1, strength));
  const b = splitAlpha(strength === 1 ? glow.g2 : scaleAlpha(glow.g2, strength));
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size && (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <RadialGradient
              id={id}
              cx={0}
              cy={0}
              r={1}
              gradientUnits="userSpaceOnUse"
              gradientTransform={`translate(${size.w * cx} ${size.h * cy}) scale(${size.w * rx} ${size.h * ry})`}
            >
              <Stop offset={stops[0]} stopColor={a.color} stopOpacity={a.opacity} />
              <Stop offset={stops[1]} stopColor={b.color} stopOpacity={b.opacity} />
              <Stop offset={stops[2]} stopColor={b.color} stopOpacity={0} />
              <Stop offset={1} stopColor={b.color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  );
}

/**
 * Ebeveyninin tamamını kaplayan 135° gradyan katmanı. Ebeveyn köşesini kırpmalı (overflow: hidden).
 * Webde/Tauri'de CSS linear-gradient, telefonda expo-linear-gradient.
 */
export function GradientFill({ pair }: { pair: GradientPair }) {
  if (Platform.OS === 'web') {
    return createElement('div', {
      'aria-hidden': true,
      style: {
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        backgroundImage: linearCss(pair),
        pointerEvents: 'none',
      },
    });
  }
  return (
    <LinearGradient
      colors={[pair[0], pair[1]]}
      start={LINEAR_135.start}
      end={LINEAR_135.end}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
