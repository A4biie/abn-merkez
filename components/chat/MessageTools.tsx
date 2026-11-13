// Mesajın üstüne gelince çıkan araç çubuğu (😊 ↩ ☑ ⋯), sağ tık / ⋯ menüsü (T / F kısayolları) ve
// mesajın altındaki bağlantı çipleri ("☑ Görev: …", "💡 Fikre eklendi"). 0.11 bölüm 3, design/abn-09.html: .mbar .menu .link

import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import type { Message } from '@/lib/chat';
import { code, openBugForm, useBugs } from '@/lib/bugs';
import { ideaFromMessage, openConvertTask } from '@/lib/convert';
import { useIdeas, useTasks } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

import { goTask } from './ConvertTaskModal';

const SPRING = 'cubic-bezier(0.2, 1.25, 0.35, 1)';
const pop = css.keyframes({ from: { opacity: 0, transform: [{ scale: 0.8 }] }, to: { opacity: 1, transform: [{ scale: 1 }] } });
const menuIn = css.keyframes({
  from: { opacity: 0, transform: [{ scale: 0.96 }, { translateY: -4 }] },
  to: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] },
});
const fadeIn = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

/** Görev / fikir dönüşümleri (menü, araç çubuğu ve telefondaki işlem paneli ortak kullanır). */
export function useConvert(message: Message, projectId: string | null) {
  const team = useTeam();
  const say = useToast();
  return {
    toTask: () => openConvertTask(message, projectId),
    toBug: () => openBugForm({ message, projectId }),
    toIdea: async () => {
      const err = await ideaFromMessage(message, team.meId, projectId);
      say(err ? 'Fikir eklenemedi' : "Fikir Defteri'ne eklendi");
    },
    copy: () => {
      navigator.clipboard?.writeText(message.body).then(
        () => say('Kopyalandı'),
        () => say('Kopyalanamadı'),
      );
    },
  };
}

function BarBtn({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityLabel={label} pressScale={1} style={{ width: 30, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }}>
      <Txt size={14}>{icon}</Txt>
    </Press>
  );
}

/** side: balonun hangi kenarına yaslanır (başkasının mesajı solda, seninki sağda); dar balonda dışarı taşmaz. */
export function HoverBar({
  side,
  onHeart,
  onReply,
  onTask,
  onMore,
}: {
  side: 'left' | 'right';
  onHeart: () => void;
  onReply: () => void;
  onTask: () => void;
  onMore: (x: number, y: number) => void;
}) {
  const { colors } = useTheme();
  const bar = useRef<unknown>(null);
  const more = useCallback(() => {
    const r = (bar.current as HTMLElement | null)?.getBoundingClientRect();
    onMore((r?.right ?? 240) - 230, (r?.bottom ?? 0) + 6);
  }, [onMore]);
  return (
    <View
      ref={bar as never}
      style={{
        position: 'absolute',
        [side]: 0,
        top: -14,
        zIndex: 5,
        flexDirection: 'row',
        gap: 2,
        padding: 3,
        borderRadius: 10,
        backgroundColor: colors.surface2,
        boxShadow: `0 0 0 1px ${colors.line}, 0 6px 16px rgba(0,0,0,.35)`,
      }}
    >
      <BarBtn icon="😊" label="Tepki" onPress={onHeart} />
      <BarBtn icon="↩" label="Yanıtla" onPress={onReply} />
      <BarBtn icon="☑" label="Göreve çevir" onPress={onTask} />
      <BarBtn icon="⋯" label="Diğer" onPress={more} />
    </View>
  );
}

export function MessageMenu({ x, y, message, projectId, onClose }: { x: number; y: number; message: Message; projectId: string | null; onClose: () => void }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const c = useConvert(message, projectId);
  const box = useRef<unknown>(null);
  const items = [
    { k: 't', icon: '☑', label: 'Göreve çevir', run: c.toTask },
    { k: 'f', icon: '💡', label: 'Fikre çevir', run: c.toIdea },
    { k: 'b', icon: '🐞', label: 'Bug olarak bildir', run: c.toBug },
  ];
  const run = (f: () => void) => {
    onClose();
    f();
  };
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'escape') return onClose();
      const it = items.find((i) => i.k === k);
      if (it) {
        e.preventDefault();
        runRef.current(it.run);
      }
    };
    const down = (e: PointerEvent) => {
      const el = box.current as HTMLElement | null;
      if (!el?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', down, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('pointerdown', down, true);
    };
    // items sabit; kısayollar her açılışta bir kez bağlanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const left = Math.max(8, Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 400) - 238));
  const top = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 600) - 170);
  const row = (icon: string, label: string, f: () => void, kbd?: string) => (
    <MenuRow key={label} icon={icon} label={label} kbd={kbd} onPress={() => run(f)} />
  );

  return (
    <Animated.View
      ref={box as never}
      role="menu"
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 1040,
        width: 230,
        padding: 6,
        borderRadius: 14,
        backgroundColor: colors.surface,
        boxShadow: `0 0 0 1px ${colors.line}, 0 24px 60px rgba(0,0,0,.45)`,
        transformOrigin: 'top right',
        animationName: motion.reduced ? fadeIn : menuIn,
        animationDuration: 160,
        animationTimingFunction: SPRING,
        animationFillMode: 'both',
      } as object}
    >
      {items.map((i) => row(i.icon, i.label, i.run, i.k.toUpperCase()))}
      <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 4 }} />
      {row('📋', 'Metni kopyala', c.copy)}
    </Animated.View>
  );
}

function MenuRow({ icon, label, kbd, onPress }: { icon: string; label: string; kbd?: string; onPress: () => void }) {
  const { colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  return (
    <Press
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      role="menuitem"
      pressScale={1}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 9,
        backgroundColor: hovered ? `color-mix(in srgb, ${colors.a1} 18%, transparent)` : undefined,
      }}
    >
      <Txt size={14}>{icon}</Txt>
      <Txt size={14} weight={700} style={{ flex: 1 }}>
        {label}
      </Txt>
      {kbd ? (
        <Txt size={11} color="muted" style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', paddingHorizontal: 6, borderRadius: 6, backgroundColor: colors.chip }}>
          {kbd}
        </Txt>
      ) : null}
    </Press>
  );
}

/** Mesajın altındaki bağlantı çipleri. Kaynak mesaj id'si görev / fikir kayıtlarında; herkes görür. */
type Link = { id: string; label: string; go: () => void };
const LinksContext = createContext<Map<string, Link[]>>(new Map());

/** Sohbet odası başına bir kez: mesaj id'si → bağlantı çipleri. Balonlar ayrı ayrı listelere abone olmasın
 *  (her görev / fikir / bug değişikliğinde bütün balonlar yeniden çiziliyordu). */
export function MessageLinksProvider({ children }: { children: React.ReactNode }) {
  const tasks = useTasks();
  const ideas = useIdeas();
  const bugs = useBugs();
  const map = useMemo(() => {
    const m = new Map<string, Link[]>();
    const add = (mid: string | null | undefined, l: Link) => {
      if (!mid) return;
      const a = m.get(mid);
      if (a) a.push(l);
      else m.set(mid, [l]);
    };
    for (const b of bugs.data ?? [])
      add(b.source_message_id, { id: 'b' + b.id, label: '🐞 ' + code(b) + ' açıldı', go: () => router.navigate({ pathname: '/buglar', params: { bug: b.id } }) });
    for (const t of tasks.data ?? []) add(t.source_message_id, { id: 't' + t.id, label: '☑ Görev: ' + t.title, go: () => goTask(t.id) });
    for (const i of ideas.data ?? []) add(i.source_message_id, { id: 'i' + i.id, label: '💡 Fikre eklendi', go: () => router.navigate('/fikirler') });
    return m;
  }, [tasks.data, ideas.data, bugs.data]);
  return <LinksContext.Provider value={map}>{children}</LinksContext.Provider>;
}

export function MessageLinks({ messageId, align }: { messageId: string; align: 'flex-start' | 'flex-end' }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const linked = useContext(LinksContext).get(messageId);
  if (!linked?.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: align, maxWidth: 360 }}>
      {linked.map((l) => (
        <Animated.View
          key={l.id}
          style={{
            animationName: motion.reduced ? fadeIn : pop,
            animationDuration: 350,
            animationTimingFunction: SPRING,
            animationFillMode: 'both',
          }}
        >
          <Press
            onPress={l.go}
            style={{
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: `color-mix(in srgb, ${colors.a1} 14%, transparent)`,
            }}
          >
            <Txt size={12} weight={800} numberOfLines={1} style={{ color: colors.a1 }}>
              {l.label}
            </Txt>
          </Press>
        </Animated.View>
      ))}
    </View>
  );
}

export const isWeb = Platform.OS === 'web';
