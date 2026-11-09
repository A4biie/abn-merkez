import { useState } from 'react';
import Animated, { useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { BoardLink } from '@/lib/board';
import { useTheme } from '@/theme/ThemeProvider';
import { edge, linkGeom, linkPaths, type Rect } from './geometry';
import { liveRect, type Live, type LiveRect } from './live';

/** Bağlantı katmanının dünya koordinatındaki yeri; bütün kartları ve biraz fazlasını kaplar. */
export type Origin = { x: number; y: number; w: number; h: number };

type Snap = {
  dragId: string;
  dragX: number;
  dragY: number;
  rzId: string;
  rzW: number;
  rzH: number;
  bendId: string;
  bendX: number;
  bendY: number;
  tmpFrom: string;
  tmpX: number;
  tmpY: number;
  zoom: number;
};

/**
 * Canlı değerlerin (sürükleme, boyutlandırma, eğme, geçici bağlantı) React'teki kopyası.
 * SVG yolları webde UI iş parçacığından güncellenemediği için bağlantılar bu kopyayla JS'te çizilir;
 * değer değişmedikçe yeniden çizim olmaz, değişince yalnızca bağlantı katmanı çizilir.
 */
function useLiveSnapshot(live: Live): Snap {
  const read = (): Snap => {
    'worklet';
    const rz = live.rz.get();
    const b = live.bend.get();
    const t = live.tmp.get();
    return {
      dragId: live.drag.id.get(),
      dragX: live.drag.x.get(),
      dragY: live.drag.y.get(),
      rzId: rz.id,
      rzW: rz.w,
      rzH: rz.h,
      bendId: b.id,
      bendX: b.x,
      bendY: b.y,
      tmpFrom: t.from,
      tmpX: t.x,
      tmpY: t.y,
      zoom: live.cam.zoom.get(),
    };
  };
  const [snap, setSnap] = useState<Snap>(() => ({
    dragId: '',
    dragX: 0,
    dragY: 0,
    rzId: '',
    rzW: 0,
    rzH: 0,
    bendId: '',
    bendX: 0,
    bendY: 0,
    tmpFrom: '',
    tmpX: 0,
    tmpY: 0,
    zoom: 1,
  }));
  useAnimatedReaction(
    () => {
      const s = read();
      // Yakınlaştırma sadece geçici çizginin kalınlığını etkiler; o yokken izlenmez.
      return s.tmpFrom ? s : { ...s, zoom: 0 };
    },
    (now, prev) => {
      if (!prev || JSON.stringify(now) !== JSON.stringify(prev)) scheduleOnRN(setSnap, now);
    },
  );
  return snap;
}

function rectWith(rects: LiveRect[], snap: Snap, id: string): Rect | null {
  const r = rects.find((x) => x.id === id);
  if (!r) return null;
  return {
    x: snap.dragId === id ? snap.dragX : r.x,
    y: snap.dragId === id ? snap.dragY : r.y,
    w: snap.rzId === id ? snap.rzW : r.w,
    h: snap.rzId === id ? snap.rzH : r.h,
  };
}

/** Bütün bağlantılar ve sürüklenen yeni bağlantı tek bir SVG'de, kartların arkasında. */
export function LinksLayer({
  links,
  rects,
  selectedLink,
  live,
  origin,
}: {
  links: BoardLink[];
  rects: LiveRect[];
  selectedLink: string | null;
  live: Live;
  origin: Origin;
}) {
  const { colors } = useTheme();
  const snap = useLiveSnapshot(live);
  const ox = origin.x;
  const oy = origin.y;
  const shift = (r: Rect): Rect => ({ ...r, x: r.x - ox, y: r.y - oy });

  const tmpRect = snap.tmpFrom ? rectWith(rects, snap, snap.tmpFrom) : null;
  const tmpStart = tmpRect ? edge(tmpRect, snap.tmpX, snap.tmpY) : null;
  const zi = 1 / (snap.zoom || 1);

  return (
    <Svg width={origin.w} height={origin.h} pointerEvents="none" style={{ position: 'absolute', left: ox, top: oy, zIndex: 1 }}>
      {links.map((l) => {
        const A = rectWith(rects, snap, l.from_item);
        const B = rectWith(rects, snap, l.to_item);
        if (!A || !B) return null;
        const bx = snap.bendId === l.id ? snap.bendX : l.bend_x;
        const by = snap.bendId === l.id ? snap.bendY : l.bend_y;
        const { line, heads } = linkPaths(linkGeom(shift(A), shift(B), bx, by), l.start_cap, l.end_cap);
        const sel = l.id === selectedLink;
        const color = sel ? colors.a2 : colors.muted;
        return [
          <Path
            key={`${l.id}-l`}
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={sel ? 3.5 : 2.2}
            strokeLinecap="round"
            strokeDasharray={l.dashed ? '8 7' : undefined}
          />,
          <Path key={`${l.id}-h`} d={heads} fill={color} />,
        ];
      })}
      {tmpStart && (
        <>
          <Line
            x1={tmpStart[0] - ox}
            y1={tmpStart[1] - oy}
            x2={snap.tmpX - ox}
            y2={snap.tmpY - oy}
            stroke={colors.a2}
            strokeWidth={3 * zi}
            strokeLinecap="round"
            strokeDasharray={`${7 * zi} ${7 * zi}`}
          />
          <Circle cx={snap.tmpX - ox} cy={snap.tmpY - oy} r={7 * zi} fill={colors.a2} />
        </>
      )}
    </Svg>
  );
}

/**
 * Seçili bağlantının tutamaçları: ortada eğme noktası, iki uçta taşıma noktaları.
 * Dokunuşlar tuvalin hareketinde yakalanır; bunlar sadece görünüş.
 */
export function LinkHandles({ link, live }: { link: BoardLink; live: Live }) {
  const { colors } = useTheme();

  const at = (which: 'h' | 'p1' | 'p2', size: number) => {
    'worklet';
    const A = liveRect(live, link.from_item);
    const B = liveRect(live, link.to_item);
    const z = live.cam.zoom.get();
    const s = size / z;
    if (!A || !B) return { opacity: 0, width: s, height: s };
    const bend = live.bend.get();
    const g = linkGeom(A, B, bend.id === link.id ? bend.x : link.bend_x, bend.id === link.id ? bend.y : link.bend_y);
    const p = g[which];
    return {
      opacity: 1,
      width: s,
      height: s,
      borderRadius: s / 2,
      borderWidth: 3 / z,
      transform: [{ translateX: p[0] - s / 2 }, { translateY: p[1] - s / 2 }],
    };
  };

  const bendStyle = useAnimatedStyle(() => at('h', 24));
  const startStyle = useAnimatedStyle(() => at('p1', 18));
  const endStyle = useAnimatedStyle(() => at('p2', 18));
  const shadow = '0 2px 8px rgba(0,0,0,0.25)';
  const base = { position: 'absolute' as const, left: 0, top: 0, zIndex: 55, boxShadow: shadow };

  return (
    <>
      <Animated.View pointerEvents="none" style={[base, { backgroundColor: colors.nav, borderColor: colors.a2 }, bendStyle]} />
      <Animated.View pointerEvents="none" style={[base, { backgroundColor: colors.a2, borderColor: colors.bg }, startStyle]} />
      <Animated.View pointerEvents="none" style={[base, { backgroundColor: colors.a2, borderColor: colors.bg }, endStyle]} />
    </>
  );
}
