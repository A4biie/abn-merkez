// Gradyan token'larından çizime: webde/Tauri'de CSS, telefonda expo-linear-gradient ve react-native-svg.
// Bileşenler gradyanı kendileri yazmaz; GradientCard / GradientButton (0.8.0) bunları kullanır.
// Gradyan token'ı yoksa (düz temalar: Noir, Zeytin, Adaçayı, Pudra) çağıran düz renge düşer.

import type { GradientPair, ThemeGradients } from './themes';

/** expo-linear-gradient için 135°: sol üstten sağ alta. */
export const LINEAR_135 = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;

/** linear-gradient(135deg, a 0%, b 100%) */
export function linearCss(pair: GradientPair): string {
  return `linear-gradient(135deg, ${pair[0]} 0%, ${pair[1]} 100%)`;
}

/**
 * "Üstten ışık": radial-gradient(130% 55% at 50% -12%, g1 0%, g2 45%, transparent 75%).
 * Telefonda aynı elips react-native-svg RadialGradient ile çizilir (bkz. GLOW_GEOMETRY).
 */
export function glowCss(glow: ThemeGradients['bgGlow'], strength = 1): string {
  const g1 = strength === 1 ? glow.g1 : scaleAlpha(glow.g1, strength);
  const g2 = strength === 1 ? glow.g2 : scaleAlpha(glow.g2, strength);
  return `radial-gradient(130% 55% at 50% -12%, ${g1} 0%, ${g2} 45%, transparent 75%)`;
}

/**
 * Elipsin ekrana göre yeri ve boyu (CSS ile aynı): merkez yatayda ortada, ekranın %12 üstünde;
 * yatay yarıçap genişliğin %130'u, dikey yarıçap yüksekliğin %55'i. Duraklar 0 / 0.45 / 0.75.
 */
export const GLOW_GEOMETRY = { cx: 0.5, cy: -0.12, rx: 1.3, ry: 0.55, stops: [0, 0.45, 0.75] } as const;

/** rgba(...) rengin opaklığını çarpar (bildirim kartındaki "yarı yoğunluk" ışık gibi). */
export function scaleAlpha(rgba: string, k: number): string {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(rgba);
  if (!m) return rgba;
  return `rgba(${m[1]},${m[2]},${m[3]},${+(Number(m[4]) * k).toFixed(3)})`;
}

/** rgba(...) / #rrggbb → { color: '#rrggbb', opacity } (SVG Stop için). */
export function splitAlpha(color: string): { color: string; opacity: number } {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(color);
  if (!m) return { color, opacity: 1 };
  const hex = [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  return { color: `#${hex}`, opacity: Number(m[4]) };
}
