// Görevler Kanban'ı (0.11 bölüm 2, design/abn-09.html: .board / .col / .card / .ghost).
// Sürükle bırak işaretçi olaylarıyla (fare ve dokunma aynı yol): farede 5 px kıpırdayınca, dokunmada basılı tutunca
// (0.35 sn) başlar. Bırakılacak yerde ince a1 çizgi, üstündeki sütun vurgulu; sürüklenen kart yerinde soluk kalır.
// Bırakınca kart yaylanarak oturur (land). Sıra position kolonunda (iki komşunun ortası).

import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { useActions } from '@/components/sheets/ActionsProvider';
import { Press } from '@/components/ui/Press';
import { Portal } from '@/components/ui/Portal';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { TASK_ORDER, TASK_STATUS } from '@/lib/labels';
import { moveTask } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import type { Task, TaskStatus } from '@/lib/types';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

import { TaskCard } from './TaskCard';

const SPRING = 'cubic-bezier(0.2, 1.25, 0.35, 1)';
const land = css.keyframes({ from: { transform: [{ scale: 1.04 }] }, to: { transform: [{ scale: 1 }] } });
const fadeIn = css.keyframes({ from: { opacity: 0.4 }, to: { opacity: 1 } });

/** Yaylanma animasyonunu yeniden oynatmak için artan sayı. */
let landSeq = 0;
export const nextLand = () => ++landSeq;

type Drag = { id: string; x: number; y: number; w: number; ox: number; oy: number };
type Over = { status: TaskStatus; index: number } | null;

export function KanbanBoard({ tasks, land: landReq, phone }: { tasks: Task[]; land?: { id: string; n: number } | null; phone?: boolean }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const team = useTeam();
  const actions = useActions();
  const say = useToast();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<Over>(null);
  const [landed, setLanded] = useState<{ id: string; n: number } | null>(null);
  const shownLand = landReq && (!landed || landReq.n > landed.n) ? landReq : landed;
  const suppressClick = useRef(false);
  const state = useRef({ drag, over, tasks });
  useEffect(() => {
    state.current = { drag, over, tasks };
  });

  const cols = TASK_ORDER.map((status) => ({ status, cards: tasks.filter((t) => t.status === status) }));

  // Sütun ve sıra: işaretçinin altındaki [data-kcol], içinde orta noktası işaretçinin altında kalan ilk kart.
  const hit = (x: number, y: number, dragId: string): Over => {
    for (const col of Array.from(document.querySelectorAll<HTMLElement>('[data-kcol]'))) {
      const r = col.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top - 40 || y > r.bottom + 40) continue;
      const cards = Array.from(col.querySelectorAll<HTMLElement>('[data-kcard]')).filter((c) => c.dataset.kcard !== dragId);
      let index = cards.length;
      for (let i = 0; i < cards.length; i++) {
        const cr = cards[i].getBoundingClientRect();
        if (y < cr.top + cr.height / 2) {
          index = i;
          break;
        }
      }
      return { status: col.dataset.kcol as TaskStatus, index };
    }
    return null;
  };

  const drop = (t: Task, o: Over) => {
    if (!o) return;
    const list = state.current.tasks.filter((x) => x.status === o.status && x.id !== t.id);
    const prev = list[o.index - 1];
    const next = list[o.index];
    const position = prev && next ? (prev.position + next.position) / 2 : prev ? prev.position + 1 : next ? next.position - 1 : 0;
    const moved = o.status !== t.status;
    const mine = t.assignee_id === team.meId || team.isAdmin;
    if (!moved) {
      // Aynı yere bırakıldıysa bir şey yapma.
      const full = state.current.tasks.filter((x) => x.status === o.status);
      const at = full.indexOf(t);
      if (full[at - 1]?.id === prev?.id && full[at + 1]?.id === next?.id) return;
    }
    if (t.status === 'havuz' && moved && !mine) {
      // Havuzdan almak "Ben alırım" ile aynı kurallardan geçer (kilit, proje üyeliği).
      actions.claim(t);
      setLanded({ id: t.id, n: nextLand() });
      return;
    }
    if (!mine) {
      say('Bu görevi sadece üzerindeki kişi taşıyabilir');
      return;
    }
    setLanded({ id: t.id, n: nextLand() });
    moveTask(t, o.status, position).then((err) => {
      if (err) say('Görev taşınamadı, tekrar dene');
      else if (moved && o.status === 'bitti') say(`"${t.title}" bitti 🎉`);
    });
  };

  const onPointerDown = (t: Task) => (e: React.PointerEvent<HTMLElement>) => {
    if (Platform.OS !== 'web' || e.button > 0) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const touch = e.pointerType !== 'mouse';
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = (x: number, y: number) => {
      started = true;
      setDrag({ id: t.id, x, y, w: r.width, ox: sx - r.left, oy: sy - r.top });
      setOver(hit(x, y, t.id));
    };
    const blockScroll = (ev: TouchEvent) => {
      if (started) ev.preventDefault();
    };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!started) {
        if (touch) {
          if (Math.hypot(dx, dy) > 8) cleanup(); // kaydırıyor
          return;
        }
        if (Math.hypot(dx, dy) < 5) return;
        start(ev.clientX, ev.clientY);
      }
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
      setOver(hit(ev.clientX, ev.clientY, t.id));
    };
    const up = () => {
      const o = state.current.over;
      if (started) {
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 0);
        drop(t, o);
      }
      setDrag(null);
      setOver(null);
      cleanup();
    };
    const cleanup = () => {
      clearTimeout(timer);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      document.removeEventListener('touchmove', blockScroll);
    };
    if (touch) timer = setTimeout(() => start(sx, sy), 350);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    document.addEventListener('touchmove', blockScroll, { passive: false });
  };

  const dragged = drag ? tasks.find((t) => t.id === drag.id) : undefined;
  const line = <View style={{ height: 4, borderRadius: 4, backgroundColor: colors.a1, marginVertical: -2 }} />;

  return (
    <View
      style={{ flex: 1, minHeight: 0 }}
      {...({
        onClickCapture: (e: { stopPropagation: () => void; preventDefault: () => void }) => {
          if (suppressClick.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        },
      } as object)}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6, flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', gap: 12, minWidth: phone ? undefined : 1000, flex: 1 }}>
          {cols.map(({ status, cards }) => {
            const st = TASK_STATUS[status];
            const isOver = over?.status === status;
            const rest = drag ? cards.filter((c) => c.id !== drag.id) : cards;
            return (
              <View
                key={status}
                {...({ dataSet: { kcol: status } } as object)}
                style={{
                  flex: phone ? undefined : 1,
                  width: phone ? 280 : undefined,
                  minWidth: 220,
                  minHeight: 320,
                  borderRadius: 16,
                  backgroundColor: isOver ? colors.surface : `color-mix(in srgb, ${colors.surface} 70%, transparent)`,
                  boxShadow: isOver ? `inset 0 0 0 2px color-mix(in srgb, ${colors.a1} 55%, transparent)` : undefined,
                  transitionProperty: 'box-shadow, background-color',
                  transitionDuration: '150ms',
                } as object}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: st.dot }} />
                  <Txt weight={800}>{st.label}</Txt>
                  <Txt size={12} weight={700} color="muted">
                    {cards.length}
                  </Txt>
                  <AddButton status={status} />
                </View>
                <View style={{ paddingTop: 4, paddingHorizontal: 8, paddingBottom: 10, gap: 8, minHeight: 60 }}>
                  {cards.map((t) => {
                    const i = rest.indexOf(t);
                    const isLand = shownLand?.id === t.id;
                    return (
                      <View key={t.id} style={{ gap: 8 }}>
                        {isOver && over.index === i && drag && t.id !== drag.id && line}
                        <Animated.View
                          key={isLand ? 'l' + shownLand.n : 'n'}
                          {...({ dataSet: { kcard: t.id }, onPointerDown: onPointerDown(t) } as object)}
                          style={[
                            {
                              opacity: drag?.id === t.id ? 0.35 : 1,
                              cursor: 'grab',
                              userSelect: 'none',
                              touchAction: phone ? 'pan-x pan-y' : undefined,
                            } as object,
                            isLand
                              ? {
                                  animationName: motion.reduced ? fadeIn : land,
                                  animationDuration: 350,
                                  animationTimingFunction: SPRING,
                                }
                              : null,
                          ]}
                        >
                          <TaskCard task={t} variant="kanban" />
                        </Animated.View>
                      </View>
                    );
                  })}
                  {isOver && drag && over.index >= rest.length && line}
                  {cards.length === 0 && !isOver && (
                    <Txt size={13} color="muted" style={{ textAlign: 'center', paddingVertical: 14 }}>
                      Boş
                    </Txt>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {drag && dragged && Platform.OS === 'web' && (
        <Portal>
        <View
          pointerEvents="none"
          style={{
            position: 'fixed',
            left: drag.x - drag.ox,
            top: drag.y - drag.oy,
            width: drag.w,
            zIndex: 2000,
            opacity: 0.95,
            transform: [{ rotate: '2deg' }],
            boxShadow: '0 18px 40px rgba(0,0,0,.35)',
            borderRadius: 18,
          } as object}
        >
          <TaskCard task={dragged} variant="kanban" />
        </View>
        </Portal>
      )}
    </View>
  );
}

function AddButton({ status }: { status: TaskStatus }) {
  const { colors } = useTheme();
  const actions = useActions();
  const [hover, setHover] = useState(false);
  return (
    <Press
      onPress={() => actions.openAddTask({ status })}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityLabel={TASK_STATUS[status].label + ' sütununa görev ekle'}
      style={{
        marginLeft: 'auto',
        width: 26,
        height: 26,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: hover ? colors.chip : undefined,
      }}
    >
      <Txt size={18} color={hover ? undefined : 'muted'} leading={1}>
        +
      </Txt>
    </Press>
  );
}
