import { Platform, View } from 'react-native';
import { useState } from 'react';
import Animated, { useAnimatedReaction, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { css, EASE_OUT, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { hull, rrect, type Pt } from './geometry';
import { liveRect, type Live } from './live';
import type { Origin } from './Links';

// Board.dc.html: 12 noktalı yay zinciri, takip 0.38, geri çekilme 0.09, uzunluk = kart yarı boyu + 80.
const TRAIL_N = 12;
const TRAIL_FOLLOW = 0.38;
const TRAIL_RETRACT = 0.09;
const TRAIL_EXTRA = 80;


/**
 * Sürüklenen kartın arkasında kart biçimli, sona doğru incelen, soluk bir iz. Kart durunca iz
 * solmaz, kartın içine çekilerek kaybolur; küçük hareketlerde hiç görünmez.
 */
export function Trail({ live, origin }: { live: Live; origin: Origin }) {
  const { colors } = useTheme();
  const motion = useMotion();

  const pts = useSharedValue<number[]>([]);
  const tracking = useSharedValue('');
  const shown = useSharedValue(false);
  const op = useSharedValue(0);
  const d = useSharedValue('M0 0');
  const grad = useSharedValue({ x1: 0, y1: 0, x2: 1, y2: 0 });
  const ox = origin.x;
  const oy = origin.y;

  useFrameCallback((frame) => {
    'worklet';
    const dragId = live.drag.id.get();
    if (dragId && tracking.get() !== dragId) {
      // Yeni sürükleme: bütün zincir kartın merkezinden başlar.
      const r = liveRect(live, dragId);
      if (!r) return;
      const c = [r.x + r.w / 2, r.y + r.h / 2];
      const p: number[] = [];
      for (let i = 0; i < TRAIL_N; i++) p.push(c[0], c[1]);
      pts.set(p);
      tracking.set(dragId);
      shown.set(false);
      op.set(0);
    }
    const id = tracking.get();
    if (!id) return;
    const r = liveRect(live, id);
    if (!r) {
      tracking.set('');
      d.set('M0 0');
      return;
    }
    const dt = Math.min(48, Math.max(1, frame.timeSincePreviousFrame ?? 16.7));
    const p = pts.get().slice();
    const hx = r.x + r.w / 2;
    const hy = r.y + r.h / 2;
    const headMoved = Math.hypot(hx - p[0], hy - p[1]);
    p[0] = hx;
    p[1] = hy;
    const dragging = dragId === id;
    if (dragging && headMoved > 0.6) {
      const f = 1 - Math.pow(1 - TRAIL_FOLLOW, dt / 16.7);
      for (let i = 1; i < TRAIL_N; i++) {
        p[i * 2] += (p[(i - 1) * 2] - p[i * 2]) * f;
        p[i * 2 + 1] += (p[(i - 1) * 2 + 1] - p[i * 2 + 1]) * f;
      }
    } else {
      // Durunca kuyruk şeklini koruyarak kartın merkezine doğru kayar.
      const g = 1 - Math.pow(1 - TRAIL_RETRACT, dt / 16.7);
      for (let i = 1; i < TRAIL_N; i++) {
        p[i * 2] += (p[0] - p[i * 2]) * g;
        p[i * 2 + 1] += (p[1] - p[i * 2 + 1]) * g;
      }
    }
    const tx = p[(TRAIL_N - 1) * 2];
    const ty = p[(TRAIL_N - 1) * 2 + 1];
    const dx = p[0] - tx;
    const dy = p[1] - ty;
    const dl = Math.hypot(dx, dy);
    const ext =
      dl > 0.01 ? (Math.abs(dx / dl) * r.w) / 2 + (Math.abs(dy / dl) * r.h) / 2 : Math.min(r.w, r.h) / 2;
    const maxLen = ext + TRAIL_EXTRA;
    let acc = 0;
    for (let j = 1; j < TRAIL_N; j++) {
      const sx = p[j * 2] - p[(j - 1) * 2];
      const sy = p[j * 2 + 1] - p[(j - 1) * 2 + 1];
      let sl = Math.hypot(sx, sy);
      if (acc + sl > maxLen && sl > 0) {
        const k = Math.max(0, (maxLen - acc) / sl);
        p[j * 2] = p[(j - 1) * 2] + sx * k;
        p[j * 2 + 1] = p[(j - 1) * 2 + 1] + sy * k;
        sl = Math.max(0, maxLen - acc);
      }
      acc += sl;
    }
    pts.set(p);
    if (!dragging && acc < 1.5) {
      tracking.set('');
      d.set('M0 0');
      op.set(0);
      return;
    }
    const vis = acc - ext;
    if (vis > 28) shown.set(true);
    op.set(shown.get() ? Math.min(1, op.get() + dt / 120) : 0);
    if (op.get() < 0.01 || vis <= 0) {
      d.set('M0 0');
      return;
    }
    // Şekiller: kart boyunda başlar, kartın kenarından sonra sivrilerek incelir.
    let dist = 0;
    const shapes: Pt[][] = [];
    for (let q = 0; q < TRAIL_N; q++) {
      if (q > 0) dist += Math.hypot(p[q * 2] - p[(q - 1) * 2], p[q * 2 + 1] - p[(q - 1) * 2 + 1]);
      const u = Math.min(1, Math.max(0, (dist - ext * 0.85) / Math.max(1, acc - ext * 0.85)));
      const sc = Math.max(0.03, Math.pow(1 - u, 1.6));
      shapes.push(rrect(p[q * 2] - ox, p[q * 2 + 1] - oy, r.w * sc, r.h * sc));
    }
    let path = '';
    for (let m = 0; m < shapes.length - 1; m++) {
      const hp = hull(shapes[m].concat(shapes[m + 1]));
      path += 'M' + hp.map((pt) => `${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join('L') + 'Z';
    }
    d.set(path);
    grad.set({ x1: tx - ox, y1: ty - oy, x2: p[0] - ox, y2: p[1] - oy });
  });

  // Yol UI iş parçacığında hesaplanır; SVG'ye React üzerinden yazılır (webde SVG özellikleri
  // UI tarafından güncellenemiyor). Sadece bu katman yeniden çizilir.
  const [out, setOut] = useState({ d: 'M0 0', op: 0, x1: 0, y1: 0, x2: 1, y2: 0 });
  useAnimatedReaction(
    () => ({ d: d.get(), op: Math.round(op.get() * 100) / 100, ...grad.get() }),
    (now, prev) => {
      if (!prev || now.d !== prev.d || now.op !== prev.op) scheduleOnRN(setOut, now);
    },
  );

  if (motion.reduced) return null;
  return (
    <Svg
      width={origin.w}
      height={origin.h}
      pointerEvents="none"
      style={[
        { position: 'absolute', left: origin.x, top: origin.y, zIndex: 1 },
        Platform.OS === 'web' ? ({ filter: 'blur(2.5px)' } as object) : null,
      ]}
    >
      <Defs>
        <LinearGradient id="abn-trail" gradientUnits="userSpaceOnUse" x1={out.x1} y1={out.y1} x2={out.x2} y2={out.y2}>
          <Stop offset={0} stopColor={colors.a3} stopOpacity={0} />
          <Stop offset={0.55} stopColor={colors.a2} stopOpacity={0.12} />
          <Stop offset={1} stopColor={colors.a1} stopOpacity={0.26} />
        </LinearGradient>
      </Defs>
      <Path d={out.d} opacity={out.op} fill="url(#abn-trail)" fillRule="nonzero" />
    </Svg>
  );
}

// @keyframes dropGlow{0%{opacity:0;transform:scale(.98)}25%{opacity:.38}100%{opacity:0;transform:scale(1.1)}}
const dropGlow = css.keyframes({
  '0%': { opacity: 0, transform: [{ scale: 0.98 }] },
  '25%': { opacity: 0.38 },
  '100%': { opacity: 0, transform: [{ scale: 1.1 }] },
});

/** Kart uzağa bırakılınca altında kısa, bulanık, renkli bir parlama. */
export function DropGlow({ rect }: { rect: { x: number; y: number; w: number; h: number } }) {
  const { colors } = useTheme();
  const motion = useMotion();
  if (motion.reduced) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: rect.x - 4,
          top: rect.y - 4,
          width: rect.w + 8,
          height: rect.h + 8,
          borderRadius: 20,
          overflow: 'hidden',
          zIndex: 1,
          filter: [{ blur: 16 }],
        },
        {
          animationName: dropGlow,
          animationDuration: 1000,
          animationTimingFunction: EASE_OUT,
          animationFillMode: 'forwards',
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="abn-glow" x1="0" y1="0" x2="1" y2="1">
              <Stop offset={0} stopColor={colors.a1} />
              <Stop offset={0.5} stopColor={colors.a2} />
              <Stop offset={1} stopColor={colors.a3} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#abn-glow)" />
        </Svg>
      </View>
    </Animated.View>
  );
}
