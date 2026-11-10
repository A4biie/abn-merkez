// Tam profil penceresi (profil bölüm 2, ABN Profil Prototipi: .full). 640 px, arka plan bulanık ve karartılmış.
// Esc, arka plana tıklama ya da × ile kapanır; Tab pencerenin içinde döner; arkadaki sayfa kaymaz.
// Kişinin verisi ekip listesinden okunur, profil değişince pencere animasyon tekrar oynamadan güncellenir.

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/auth';
import { openDirectRoom } from '@/lib/chat';
import { customStatus, statusLine } from '@/lib/presence';
import { closeProfile, openEditor, useProfileModal } from '@/lib/profileModal';
import { useIdeas, useProjects, useTasks } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useTeam } from '@/lib/team';
import { timeAgo } from '@/lib/time';
import type { Profile } from '@/lib/types';
import { useQuery } from '@/lib/useQuery';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

import { useShadow } from './MiniProfile';
import { Label, PresenceAvatar, RoleChips, useBannerStyle } from './ProfileCard';

const SPRING = 'cubic-bezier(0.2, 1.25, 0.35, 1)';
const popIn = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 14 }, { scale: 0.97 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});
const fadeIn = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

type Tab = 'hakkinda' | 'gorevler' | 'etkinlik';
const TABS: { id: Tab; label: string }[] = [
  { id: 'hakkinda', label: 'Hakkında' },
  { id: 'gorevler', label: 'Görevler' },
  { id: 'etkinlik', label: 'Etkinlik' },
];

export function ProfileModal() {
  const id = useProfileModal();
  const team = useTeam();
  const person = id ? team.person(id) : undefined;
  if (!id || !person) return null;
  return <Modal key={id} person={person} />;
}

function Modal({ person }: { person: Profile }) {
  const { colors } = useTheme();
  const { profile: me } = useAuth();
  const motion = useMotion();
  const shadow = useShadow();
  const say = useToast();
  const banner = useBannerStyle(person);
  const [tab, setTab] = useState<Tab>('hakkinda');
  const [more, setMore] = useState(false);
  const box = useRef<unknown>(null);
  const isMe = person.id === me?.id;
  const cs = customStatus(person);

  // Esc, odak tuzağı, arka plan kaydırma kilidi.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = box.current as HTMLElement | null;
    const prevFocus = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>('button, [role="button"], [role="tab"], a, input, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
      );
    focusables()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeProfile();
      } else if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const i = f.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : i === f.length - 1 ? 0 : i + 1;
        e.preventDefault();
        f[next]?.focus();
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.body.style.overflow = overflow;
      prevFocus?.focus?.();
    };
  }, []);

  const message = async () => {
    try {
      const roomId = await openDirectRoom(person.id);
      closeProfile();
      router.navigate({ pathname: '/sohbet/[id]', params: { id: roomId } });
    } catch {
      say('Sohbet açılamadı');
    }
  };

  const pill = (label: string, onPress: () => void, primary = false) => (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      bg={primary ? 'a2' : undefined}
      gradient={primary ? 'btn' : undefined}
      style={{
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: primary ? undefined : colors.chip,
      }}
    >
      <Txt size={13.5} weight={800} color={primary ? 'a2-ink' : undefined}>
        {label}
      </Txt>
    </Press>
  );

  return (
    <Animated.View
      style={[
        {
          position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute',
          inset: 0,
          zIndex: 1000,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          backgroundColor: 'rgba(0,0,0,0.5)',
          animationName: fadeIn,
          animationDuration: 160,
          animationFillMode: 'both',
        },
        Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as object) : null,
      ]}
    >
      {/* Arka plana tıklama kapatır. */}
      <Press onPress={closeProfile} accessibilityLabel="Kapat" pressScale={1} style={{ position: 'absolute', inset: 0 } as object} />
      <Animated.View
        ref={box as never}
        role="dialog"
        aria-modal
        aria-label={(person.full_name || 'Adsız') + ' profili'}
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '85%',
          borderRadius: 22,
          overflow: 'hidden',
          backgroundColor: colors.surface,
          boxShadow: `0 0 0 1px ${colors.line}, ${shadow}`,
          animationName: motion.reduced ? fadeIn : popIn,
          animationDuration: motion.reduced ? 150 : 260,
          animationTimingFunction: motion.reduced ? 'ease' : SPRING,
          animationFillMode: 'both',
        }}
      >
        <ScrollView>
          <View style={[{ height: 160 }, banner]} />
          <Press
            onPress={closeProfile}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.45)',
            }}
          >
            <Txt size={16} weight={800} style={{ color: '#fff' }}>
              ✕
            </Txt>
          </Press>
          <View
            style={{
              position: 'absolute',
              left: 22,
              top: 104,
              borderRadius: 999,
              padding: 6,
              backgroundColor: colors.surface,
            }}
          >
            <PresenceAvatar person={person} size={96} isMe={isMe} ring={colors.surface} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 14, minHeight: 64 }}>
            {isMe ? (
              pill('Profili düzenle', () => {
                openEditor();
              }, true)
            ) : (
              <>
                {pill('Mesaj gönder', message, true)}
                <View>
                  {pill('⋯', () => setMore(!more))}
                  {more && (
                    <View
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 44,
                        zIndex: 5,
                        minWidth: 190,
                        padding: 6,
                        borderRadius: 14,
                        backgroundColor: colors.surface,
                        boxShadow: `0 0 0 1px ${colors.line}, ${shadow}`,
                      }}
                    >
                      <Press
                        onPress={() => {
                          setMore(false);
                          navigator.clipboard?.writeText('@' + person.username);
                          say('Kullanıcı adı kopyalandı');
                        }}
                        style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 }}
                      >
                        <Txt size={13.5} weight={700}>
                          Kullanıcı adını kopyala
                        </Txt>
                      </Press>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
          <View style={{ paddingHorizontal: 22, paddingBottom: 22, gap: 14 }}>
            <View>
              <Txt size={24} weight={800} leading={1.15}>
                {person.full_name || 'Adsız'}
              </Txt>
              <Txt size={14} weight={600} color="muted">
                @{person.username}
                {person.pronouns ? ' · ' + person.pronouns : ''}
              </Txt>
              <Txt size={13} weight={700} color="text-2" style={{ marginTop: 4 }}>
                {cs ? cs.emoji + ' ' + cs.text : statusLine(person, isMe)}
              </Txt>
            </View>
            <View role="tablist" style={{ flexDirection: 'row', gap: 4, borderBottomWidth: 1, borderColor: colors.line }}>
              {TABS.map((t) => (
                <Press
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onPress={() => setTab(t.id)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderBottomWidth: 2,
                    borderColor: tab === t.id ? colors.a1 : 'transparent',
                    marginBottom: -1,
                  }}
                >
                  <Txt size={14} weight={800} color={tab === t.id ? undefined : 'muted'}>
                    {t.label}
                  </Txt>
                </Press>
              ))}
            </View>
            {tab === 'hakkinda' && <About person={person} />}
            {tab === 'gorevler' && <Tasks person={person} />}
            {tab === 'etkinlik' && <Activity person={person} />}
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{title}</Label>
      {children}
    </View>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <Txt size={13.5} color="muted">
      {children}
    </Txt>
  );
}

function About({ person }: { person: Profile }) {
  const { colors } = useTheme();
  const projects = useProjects();
  const shared = (projects.data ?? []).filter((p) => p.members.includes(person.id));
  const joined = new Date(person.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <View style={{ gap: 16 }}>
      <Section title="Hakkında">
        {person.bio ? (
          <Txt size={14} color="text-2">
            {person.bio}
          </Txt>
        ) : (
          <Empty>Henüz bir şey yazmamış.</Empty>
        )}
      </Section>
      <View style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
        <Section title="Katıldı">
          <Txt size={14} weight={700}>
            {joined}
          </Txt>
        </Section>
        {person.work_hours ? (
          <Section title="Çalışma saatleri">
            <Txt size={14} weight={700}>
              {person.work_hours}
            </Txt>
          </Section>
        ) : null}
      </View>
      <Section title="Roller">
        <RoleChips person={person} />
      </Section>
      <Section title="Projeler">
        {shared.length ? (
          <View style={{ gap: 6 }}>
            {shared.map((p) => (
              <Press
                key={p.id}
                onPress={() => {
                  closeProfile();
                  router.navigate({ pathname: '/projeler/[id]', params: { id: p.id } });
                }}
                style={{ padding: 10, borderRadius: 12, backgroundColor: colors.surface2 }}
              >
                <Txt size={14} weight={700}>
                  {p.name}
                </Txt>
              </Press>
            ))}
          </View>
        ) : (
          <Empty>Bir projede değil.</Empty>
        )}
      </Section>
    </View>
  );
}

const TASK_LABEL = { havuz: 'Havuzda', bende: 'Üzerinde', incelemede: 'İncelemede', bitti: 'Bitti' } as const;

function Row({ title, sub, onPress }: { title: string; sub: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Press
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: colors.surface2 }}
    >
      <Txt size={14} weight={700} numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </Txt>
      <Txt size={12.5} weight={600} color="muted">
        {sub}
      </Txt>
    </Press>
  );
}

const goTasks = () => {
  closeProfile();
  router.navigate({ pathname: '/gorevler', params: { sekme: 'tumu' } });
};

function Tasks({ person }: { person: Profile }) {
  const tasks = useTasks();
  const active = (tasks.data ?? []).filter((t) => t.assignee_id === person.id && t.status !== 'bitti');
  if (!active.length) return <Empty>Şu an üzerinde görev yok.</Empty>;
  return (
    <View style={{ gap: 6 }}>
      {active.map((t) => (
        <Row key={t.id} title={t.title} sub={TASK_LABEL[t.status]} onPress={goTasks} />
      ))}
    </View>
  );
}

type BoardRow = { id: string; type: string; data: Record<string, unknown>; created_at: string; board_id: string };
const BOARD_LABEL: Record<string, string> = { image: 'Fotoğraf', video: 'Video', file: 'Dosya', link: 'Bağlantı', sketch: 'Çizim' };

function Activity({ person }: { person: Profile }) {
  const ideas = useIdeas();
  const tasks = useTasks();
  const cards = useQuery(`boardItemsBy:${person.id}`, async () => {
    const { data } = await supabase
      .from('board_items')
      .select('id, type, data, created_at, board_id')
      .eq('created_by', person.id)
      .order('created_at', { ascending: false })
      .limit(10);
    return (data ?? []) as BoardRow[];
  });

  type Ev = { id: string; at: string; title: string; sub: string; go: () => void };
  const text = (d: Record<string, unknown>) =>
    ['text', 'title', 'body', 'name', 'url'].map((k) => d[k]).find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  const evs: Ev[] = [
    ...(ideas.data ?? [])
      .filter((i) => i.author_id === person.id)
      .map((i) => ({
        id: 'i' + i.id,
        at: i.created_at,
        title: i.body,
        sub: 'Fikir',
        go: () => {
          closeProfile();
          router.navigate('/fikirler');
        },
      })),
    ...(cards.data ?? []).map((c) => ({
      id: 'b' + c.id,
      at: c.created_at,
      title: text(c.data) ?? BOARD_LABEL[c.type] ?? 'Pano kartı',
      sub: 'Pano kartı',
      go: () => {
        closeProfile();
        router.navigate({ pathname: '/panolar', params: { pano: c.board_id } });
      },
    })),
    ...(tasks.data ?? [])
      .filter((t) => t.assignee_id === person.id && t.status === 'bitti')
      .map((t) => ({ id: 't' + t.id, at: t.status_changed_at, title: t.title, sub: 'Görev bitti', go: goTasks })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  if (!evs.length) return <Empty>Henüz etkinlik yok.</Empty>;
  return (
    <View style={{ gap: 6 }}>
      {evs.map((e) => (
        <Row key={e.id} title={e.title} sub={e.sub + ' · ' + timeAgo(e.at)} onPress={e.go} />
      ))}
    </View>
  );
}
