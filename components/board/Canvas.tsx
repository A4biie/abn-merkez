import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureDetector, GestureStateManager, useManualGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Txt } from '@/components/ui/Txt';
import {
  estimateHeight,
  type BoardItem,
  type BoardLink,
  type BoardWithItems,
  type ItemData,
} from '@/lib/board';
import { BoardCard } from './BoardCard';
import { clampZoom, fitTo, zoomAt, type Camera } from './camera';
import { DotGrid } from './DotGrid';
import { distToLink, handlePoints, linkGeom } from './geometry';
import { LinkHandles, LinksLayer, type Origin } from './Links';
import { BoardContext, liveRect, type BoardCtx, type Live, type LiveLink, type LiveRect } from './live';
import { DropGlow, Trail } from './Trail';

/** Hareket eşiği: altında kalan dokunuş tıklama sayılır (Board.dc.html: 6px). */
const TAP_SLOP = 6;

// Dokunuş durumu (UI iş parçacığında)
const IDLE = 0;
const PAN = 1; // boş alan sürükleniyor
const PINCH = 2; // iki parmak
const PENDING = 3; // karta basıldı, henüz kıpırdamadı
const DRAG = 4; // kart sürükleniyor
const LINK = 5; // bağlama noktasından yeni bağlantı ya da bağlantı ucu taşınıyor
const BEND = 6; // bağlantı eğiliyor
const RESIZE = 7; // bölge boyutlandırılıyor
const PENDING_LINK = 8; // bağlantıya basıldı

export type CanvasApi = {
  zoomBy: (factor: number) => void;
  fit: () => void;
  /** Yeni kartın konacağı yer: ekranın ortası, üstten üçte bir (prototipteki spot). */
  spot: (w: number, n: number) => { x: number; y: number };
};

type Props = {
  items: BoardItem[];
  links: BoardLink[];
  boards: BoardWithItems[];
  boardId: string;
  selected: string | null;
  selectedLink: string | null;
  editing: string | null;
  /** "Bağla" aracında seçilen ilk kart */
  linkFrom: string | null;
  readOnly: boolean;
  cam: Camera;
  onTapCard: (id: string, wasSelected: boolean, soft: boolean) => void;
  onTapLink: (id: string) => void;
  onTapEmpty: () => void;
  onDragStart: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onLinkDrop: (
    from: string,
    to: string | null,
    reconnect: { id: string; which: 'from' | 'to' } | null,
  ) => void;
  onBend: (id: string, x: number, y: number) => void;
  onData: (id: string, patch: ItemData) => void;
  onWidth: (id: string, w: number) => void;
  openBoard: (boardId: string) => void;
  onReady: (api: CanvasApi) => void;
};

/**
 * Sonsuz tuval. Bütün dokunuşlar tek bir el hareketinde toplanır; neye basıldığı (bağlantı tutamacı,
 * bağlama noktası, kart, bağlantı, boşluk) dünya koordinatlarına bakılarak bulunur. Sürükleme, kamera,
 * eğme ve boyutlandırma sadece paylaşılan değerleri değiştirir; React parmak kalkınca güncellenir.
 * Karta basıp kıpırdamadan bırakmak hareketi hiç başlatmaz; böylece kart içindeki düğmeler normal çalışır.
 */
export function Canvas(p: Props) {
  const { items, links, selected, selectedLink, editing, linkFrom, readOnly, cam } = p;
  const vpRef = useRef<ComponentRef<typeof View>>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [glow, setGlow] = useState<{
    key: number;
    rect: { x: number; y: number; w: number; h: number };
  } | null>(null);

  // ── Canlı durum ──
  const mode = useSharedValue(IDLE);
  const rects = useMemo<LiveRect[]>(
    () =>
      items.map((it) => ({
        id: it.id,
        x: it.x,
        y: it.y,
        w: it.w,
        h: it.type === 'zone' ? (it.h ?? 300) : (heights[it.id] ?? estimateHeight(it)),
        zone: it.type === 'zone' ? 1 : 0,
      })),
    [items, heights],
  );
  const liveLinks = useMemo<LiveLink[]>(
    () =>
      links.map((l) => ({
        id: l.id,
        from: l.from_item,
        to: l.to_item,
        bx: l.bend_x,
        by: l.bend_y,
        s: l.start_cap,
        e: l.end_cap,
      })),
    [links],
  );
  const rectsSV = useSharedValue(rects);
  const linksSV = useSharedValue(liveLinks);
  const dragId = useSharedValue('');
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const rz = useSharedValue({ id: '', w: 0, h: 0 });
  const bend = useSharedValue({ id: '', x: 0, y: 0 });
  const tmp = useSharedValue({ from: '', x: 0, y: 0, hover: '' });
  const selLink = useSharedValue('');
  const live: Live = useMemo(
    () => ({
      cam,
      rects: rectsSV,
      links: linksSV,
      drag: { id: dragId, x: dragX, y: dragY },
      rz,
      bend,
      tmp,
      selLink,
    }),
    [cam, rectsSV, linksSV, dragId, dragX, dragY, rz, bend, tmp, selLink],
  );

  useEffect(() => {
    rectsSV.set(rects);
    // Yeni konum/boyut React'e yansıdı: geçici değerler bırakılır.
    if (!mode.get()) {
      if (dragId.get()) dragId.set('');
      if (rz.get().id) rz.set({ id: '', w: 0, h: 0 });
    }
  });
  useEffect(() => {
    linksSV.set(liveLinks);
    if (!mode.get() && bend.get().id) bend.set({ id: '', x: 0, y: 0 });
  });

  const selectedSV = useSharedValue('');
  const editingSV = useSharedValue('');
  const readOnlySV = useSharedValue(readOnly);
  useEffect(() => {
    selectedSV.set(selected ?? '');
    editingSV.set(editing ?? '');
    readOnlySV.set(readOnly);
    selLink.set(selectedLink ?? '');
  }, [selected, editing, readOnly, selectedLink, selectedSV, editingSV, readOnlySV, selLink]);

  // ── Kart içi düğme bilgisi (JS tarafı) ──
  const softAt = useRef(0);
  const soft = useCallback(() => {
    softAt.current = Date.now();
  }, []);

  const tapCard = useCallback(
    // Kart içi düğmenin onPress'i dokunuş bittikten hemen sonra gelir; ona bir tık süre tanınır.
    (id: string, wasSelected: boolean) =>
      setTimeout(() => p.onTapCard(id, wasSelected, Date.now() - softAt.current < 700), 30),
    [p],
  );
  const finishDrag = useCallback(
    (id: string, x: number, y: number, ox: number, oy: number) => {
      p.onMove(id, x, y);
      if (Math.hypot(x - ox, y - oy) > 40) {
        const r = rects.find((it) => it.id === id);
        if (r) setGlow({ key: Date.now(), rect: { x, y, w: r.w, h: r.h } });
      }
    },
    [p, rects],
  );
  useEffect(() => {
    if (!glow) return;
    const t = setTimeout(() => setGlow(null), 1000);
    return () => clearTimeout(t);
  }, [glow]);

  // ── Hareket durumu ──
  const g = useSharedValue({
    sx: 0,
    sy: 0,
    ox: 0,
    oy: 0,
    ow: 0,
    oh: 0,
    moved: false,
    target: '',
    wasSelected: false,
    d0: 1,
    z0: 1,
    wx: 0,
    wy: 0,
    reconnId: '',
    reconnWhich: 'to' as 'from' | 'to',
  });

  /** Dünya noktasının altındaki en üstteki kart (bölgeler en son; except hariç). */
  const hitCard = (wx: number, wy: number, except: string, pad: number) => {
    'worklet';
    const list = rectsSV.get();
    for (const pass of [0, 1]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        if (r.zone !== pass || r.id === except) continue;
        if (wx >= r.x - pad && wx <= r.x + r.w + pad && wy >= r.y - pad && wy <= r.y + r.h + pad) return r;
      }
    }
    return null;
  };

  const cancelLive = () => {
    'worklet';
    const m = mode.get();
    if (m === DRAG) {
      const back = { duration: 220 };
      dragX.set(withTiming(g.get().ox, back));
      dragY.set(
        withTiming(g.get().oy, back, (done) => {
          if (done) dragId.set('');
        }),
      );
    }
    if (m === LINK) tmp.set({ from: '', x: 0, y: 0, hover: '' });
    if (m === BEND) bend.set({ id: '', x: 0, y: 0 });
    if (m === RESIZE) rz.set({ id: '', w: 0, h: 0 });
  };

  const gesture = useManualGesture({
    onTouchesDown: (e) => {
      'worklet';
      const all = e.allTouches;
      if (all.length >= 2) {
        // İkinci parmak: süren iş iptal edilir (kart yerine döner), yakınlaştırmaya geçilir.
        cancelLive();
        GestureStateManager.activate(e.handlerTag);
        const a = all[0];
        const b = all[1];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const z = cam.zoom.get();
        mode.set(PINCH);
        g.set({
          ...g.get(),
          d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          z0: z,
          wx: (mx - cam.x.get()) / z,
          wy: (my - cam.y.get()) / z,
          moved: true,
          target: '',
        });
        return;
      }
      const t = all[0];
      const z = cam.zoom.get();
      const wx = (t.x - cam.x.get()) / z;
      const wy = (t.y - cam.y.get()) / z;
      const base = { ...g.get(), sx: t.x, sy: t.y, moved: false, target: '' };
      cancelAnimation(cam.x);
      cancelAnimation(cam.y);
      cancelAnimation(cam.zoom);
      const editable = !readOnlySV.get();

      // 1) Seçili bağlantının tutamaçları
      const sl = selLink.get();
      if (sl && editable) {
        const L = linksSV.get().find((l) => l.id === sl);
        const A = L ? liveRect(live, L.from) : null;
        const B = L ? liveRect(live, L.to) : null;
        if (L && A && B) {
          const gm = linkGeom(A, B, L.bx, L.by);
          if (Math.hypot(wx - gm.h[0], wy - gm.h[1]) < 16 / z) {
            GestureStateManager.activate(e.handlerTag);
            mode.set(BEND);
            g.set({ ...base, target: sl });
            bend.set({ id: sl, x: L.bx, y: L.by });
            return;
          }
          for (const which of ['from', 'to'] as const) {
            const pt = which === 'from' ? gm.p1 : gm.p2;
            if (Math.hypot(wx - pt[0], wy - pt[1]) < 14 / z) {
              GestureStateManager.activate(e.handlerTag);
              mode.set(LINK);
              const fixed = which === 'from' ? L.to : L.from;
              g.set({ ...base, target: fixed, reconnId: sl, reconnWhich: which });
              tmp.set({ from: fixed, x: wx, y: wy, hover: '' });
              return;
            }
          }
        }
      }

      // 2) Seçili kartın bağlama noktaları ve bölge köşesi
      const sel = selectedSV.get();
      if (sel && editable && sel !== editingSV.get()) {
        const r = liveRect(live, sel);
        if (r) {
          const list = rectsSV.get();
          const isZone = list.some((x) => x.id === sel && x.zone === 1);
          if (
            isZone &&
            wx > r.x + r.w - 26 &&
            wx < r.x + r.w + 4 &&
            wy > r.y + r.h - 26 &&
            wy < r.y + r.h + 4
          ) {
            GestureStateManager.activate(e.handlerTag);
            mode.set(RESIZE);
            g.set({ ...base, target: sel, ow: r.w, oh: r.h });
            rz.set({ id: sel, w: r.w, h: r.h });
            return;
          }
          const hs = handlePoints(r);
          for (let i = 0; i < hs.length; i++) {
            if (Math.hypot(wx - hs[i][0], wy - hs[i][1]) < 12 / z) {
              GestureStateManager.activate(e.handlerTag);
              mode.set(LINK);
              g.set({ ...base, target: sel, reconnId: '' });
              tmp.set({ from: sel, x: wx, y: wy, hover: '' });
              return;
            }
          }
        }
      }

      // 3) Kart
      const hit = hitCard(wx, wy, '', 0);
      if (hit) {
        // Yazılan kartın içi yazı alanına ve çizime kalır.
        if (hit.id === editingSV.get()) {
          GestureStateManager.fail(e.handlerTag);
          return;
        }
        const r = liveRect(live, hit.id) ?? hit;
        mode.set(PENDING);
        g.set({
          ...base,
          ox: r.x,
          oy: r.y,
          target: hit.id,
          wasSelected: selectedSV.get() === hit.id && editingSV.get() !== hit.id,
        });
        return;
      }

      // 4) Bağlantı
      const ls = linksSV.get();
      for (let i = ls.length - 1; i >= 0; i--) {
        const L = ls[i];
        const A = liveRect(live, L.from);
        const B = liveRect(live, L.to);
        if (!A || !B) continue;
        if (distToLink(linkGeom(A, B, L.bx, L.by), wx, wy) < 10 / z) {
          mode.set(PENDING_LINK);
          g.set({ ...base, target: L.id });
          return;
        }
      }

      // 5) Boşluk: gezinme
      GestureStateManager.activate(e.handlerTag);
      mode.set(PAN);
      g.set({ ...base, ox: cam.x.get(), oy: cam.y.get() });
    },

    onTouchesMove: (e) => {
      'worklet';
      const all = e.allTouches;
      const m = mode.get();
      if (m === PINCH) {
        if (all.length < 2) return;
        const a = all[0];
        const b = all[1];
        const s = g.get();
        const nz = clampZoom((s.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / s.d0);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        cam.zoom.set(nz);
        cam.x.set(mx - s.wx * nz);
        cam.y.set(my - s.wy * nz);
        return;
      }
      if (!all.length) return;
      const t = all[0];
      const s = g.get();
      const dx = t.x - s.sx;
      const dy = t.y - s.sy;
      const z = cam.zoom.get();
      const wx = (t.x - cam.x.get()) / z;
      const wy = (t.y - cam.y.get()) / z;

      if (m === PAN) {
        if (!s.moved && Math.abs(dx) + Math.abs(dy) > 3) g.set({ ...s, moved: true });
        cam.x.set(s.ox + dx);
        cam.y.set(s.oy + dy);
      } else if (m === PENDING || m === PENDING_LINK) {
        if (Math.hypot(dx, dy) < TAP_SLOP) return;
        GestureStateManager.activate(e.handlerTag);
        if (m === PENDING_LINK || readOnlySV.get()) {
          // Bağlantıdan ya da yetkisizken karttan başlayan sürükleme tuvali gezdirir.
          mode.set(PAN);
          g.set({ ...s, sx: t.x, sy: t.y, ox: cam.x.get(), oy: cam.y.get(), moved: true });
          return;
        }
        mode.set(DRAG);
        dragX.set(s.ox);
        dragY.set(s.oy);
        dragId.set(s.target);
        scheduleOnRN(p.onDragStart, s.target);
      } else if (m === DRAG) {
        dragX.set(Math.round(s.ox + dx / z));
        dragY.set(Math.round(s.oy + dy / z));
      } else if (m === LINK) {
        const h = hitCard(wx, wy, s.target, 6);
        tmp.set({ from: s.target, x: wx, y: wy, hover: h ? h.id : '' });
      } else if (m === BEND) {
        const L = linksSV.get().find((l) => l.id === s.target);
        const A = L ? liveRect(live, L.from) : null;
        const B = L ? liveRect(live, L.to) : null;
        if (!A || !B) return;
        let bx = Math.round(wx - (A.x + A.w / 2 + B.x + B.w / 2) / 2);
        let by = Math.round(wy - (A.y + A.h / 2 + B.y + B.h / 2) / 2);
        // 10px içinde düze yapışır.
        if (Math.hypot(bx, by) < 10) {
          bx = 0;
          by = 0;
        }
        bend.set({ id: s.target, x: bx, y: by });
      } else if (m === RESIZE) {
        rz.set({
          id: s.target,
          w: Math.max(220, Math.round(s.ow + dx / z)),
          h: Math.max(140, Math.round(s.oh + dy / z)),
        });
      }
    },

    onTouchesUp: (e) => {
      'worklet';
      const lifted = e.changedTouches.map((t) => t.id);
      const left = e.allTouches.filter((t) => !lifted.includes(t.id));
      const m = mode.get();
      if (left.length === 1 && m === PINCH) {
        // İki parmaktan biri kalktı: kalanla gezinmeye devam.
        const t = left[0];
        mode.set(PAN);
        g.set({ ...g.get(), sx: t.x, sy: t.y, ox: cam.x.get(), oy: cam.y.get(), moved: true });
        return;
      }
      if (left.length > 0) return;
      const s = g.get();
      if (m === DRAG) {
        scheduleOnRN(finishDrag, s.target, dragX.get(), dragY.get(), s.ox, s.oy);
      } else if (m === PENDING) {
        scheduleOnRN(tapCard, s.target, s.wasSelected);
      } else if (m === PENDING_LINK) {
        scheduleOnRN(p.onTapLink, s.target);
      } else if (m === PAN && !s.moved) {
        scheduleOnRN(p.onTapEmpty);
      } else if (m === LINK) {
        const tt = tmp.get();
        tmp.set({ from: '', x: 0, y: 0, hover: '' });
        scheduleOnRN(
          p.onLinkDrop,
          s.target,
          tt.hover || null,
          s.reconnId ? { id: s.reconnId, which: s.reconnWhich } : null,
        );
      } else if (m === BEND) {
        const b = bend.get();
        scheduleOnRN(p.onBend, b.id, b.x, b.y);
      } else if (m === RESIZE) {
        const r = rz.get();
        scheduleOnRN(p.onResize, r.id, r.w, r.h);
      }
      mode.set(IDLE);
    },

    onTouchesCancel: () => {
      'worklet';
      cancelLive();
      mode.set(IDLE);
    },
  });

  // Webde fare tekerleği imlecin olduğu yere yakınlaştırır. Dokunmatik yüzeyde iki parmakla sıkıştırma
  // (tarayıcı ctrlKey ile gönderir) yakınlaştırır, iki parmakla kaydırma (yatay bileşeni olur) ve
  // Shift + tekerlek panoyu kaydırır.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = vpRef.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      cancelAnimation(cam.x);
      cancelAnimation(cam.y);
      cancelAnimation(cam.zoom);
      // Satır ya da sayfa birimiyle gelen tekerlek değerlerini piksele çevir (Firefox).
      const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? el.clientHeight : 1;
      const dx = ev.deltaX * unit;
      const dy = ev.deltaY * unit;
      const r = el.getBoundingClientRect();
      if (ev.ctrlKey || ev.metaKey) {
        zoomAt(cam, cam.zoom.get() * Math.exp(-dy * 0.01), ev.clientX - r.left, ev.clientY - r.top);
      } else if (ev.shiftKey || dx !== 0) {
        cam.x.set(cam.x.get() - (ev.shiftKey && dx === 0 ? dy : dx));
        cam.y.set(cam.y.get() - (ev.shiftKey ? 0 : dy));
      } else {
        // Bir tekerlek adımı (~100 px) yaklaşık %14 yakınlaştırır ya da uzaklaştırır.
        zoomAt(cam, cam.zoom.get() * Math.exp(-dy * 0.0015), ev.clientX - r.left, ev.clientY - r.top);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [cam]);

  // Üst çubuktaki −, + ve Sığdır butonları için.
  const { onReady } = p;
  useEffect(() => {
    onReady({
      zoomBy: (f) => zoomAt(cam, cam.zoom.get() * f, size.w / 2, size.h / 2, true),
      fit: () => fitTo(cam, rectsSV.get(), size.w, size.h),
      spot: (w, n) => {
        const z = cam.zoom.get();
        return {
          x: Math.round((size.w / 2 - cam.x.get()) / z - w / 2 + (n % 4) * 18),
          y: Math.round((size.h / 3 - cam.y.get()) / z + (n % 4) * 18),
        };
      },
    });
  }, [cam, size, onReady, rectsSV]);

  const layer = useAnimatedStyle(() => ({
    transform: [{ translateX: cam.x.get() }, { translateY: cam.y.get() }, { scale: cam.zoom.get() }],
  }));

  const onHeight = useCallback((id: string, h: number) => {
    setHeights((prev) => (Math.abs((prev[id] ?? 0) - h) < 0.5 ? prev : { ...prev, [id]: h }));
  }, []);

  // Bölgeler en arkada çizilir.
  const ordered = useMemo(
    () => [...items].sort((a, b) => (a.type === 'zone' ? 0 : 1) - (b.type === 'zone' ? 0 : 1)),
    [items],
  );

  // Bağlantı ve iz katmanının kapladığı alan: kartlar + her yönde 1500.
  const origin = useMemo<Origin>(() => {
    if (!rects.length) return { x: -1500, y: -1500, w: 3000, h: 3000 };
    const x0 = Math.min(...rects.map((r) => r.x)) - 1500;
    const y0 = Math.min(...rects.map((r) => r.y)) - 1500;
    const x1 = Math.max(...rects.map((r) => r.x + r.w)) + 1500;
    const y1 = Math.max(...rects.map((r) => r.y + r.h)) + 1500;
    return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
  }, [rects]);

  const ctx = useMemo<BoardCtx>(
    () => ({
      live,
      boardId: p.boardId,
      boards: p.boards,
      readOnly,
      soft,
      onData: p.onData,
      onWidth: p.onWidth,
      openBoard: p.openBoard,
    }),
    [live, p.boardId, p.boards, readOnly, soft, p.onData, p.onWidth, p.openBoard],
  );
  const selLinkObj = selectedLink ? links.find((l) => l.id === selectedLink) : undefined;

  return (
    <BoardContext.Provider value={ctx}>
      <GestureDetector gesture={gesture} touchAction="none" userSelect="none">
        <View
          ref={vpRef}
          style={[StyleSheet.absoluteFill, { overflow: 'hidden', cursor: 'grab' } as object]}
          onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          <DotGrid cam={cam} />
          <Animated.View
            style={[
              { position: 'absolute', left: 0, top: 0, width: 1, height: 1, transformOrigin: 'left top' },
              layer,
            ]}
          >
            <Trail live={live} origin={origin} />
            {glow && <DropGlow key={glow.key} rect={glow.rect} />}
            <LinksLayer links={links} rects={rects} selectedLink={selectedLink} live={live} origin={origin} />
            {ordered.map((it, i) => (
              <BoardCard
                key={it.id}
                item={it}
                index={i}
                selected={selected === it.id}
                editing={editing === it.id}
                isFrom={linkFrom === it.id}
                canLink={selected === it.id && editing !== it.id && !readOnly && !linkFrom}
                live={live}
                onHeight={onHeight}
              />
            ))}
            {selLinkObj && !readOnly && <LinkHandles link={selLinkObj} live={live} />}
            {items.length === 0 && (
              <View pointerEvents="none" style={{ position: 'absolute', left: 80, top: 80, width: 360 }}>
                <Txt size={22} weight={800} style={{ marginBottom: 6 }}>
                  Boş pano
                </Txt>
                <Txt color="muted">
                  Araç çubuğundan not, görsel, yapılacaklar listesi ya da başka bir pano ekle. Kartları her
                  yerinden tutup sürükleyebilirsin.
                </Txt>
              </View>
            )}
          </Animated.View>
        </View>
      </GestureDetector>
    </BoardContext.Provider>
  );
}

export function useCamera(compact: boolean): Camera {
  const x = useSharedValue(10);
  const y = useSharedValue(10);
  const zoom = useSharedValue(compact ? 0.6 : 1);
  return useMemo(() => ({ x, y, zoom }), [x, y, zoom]);
}
