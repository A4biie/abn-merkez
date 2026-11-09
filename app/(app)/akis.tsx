import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { PostCard } from '@/components/feed/PostCard';
import { ShareReminder, staleTaskFor, TaskNudge } from '@/components/feed/Reminders';
import { Screen } from '@/components/layout/Screen';
import { useIsWide } from '@/components/layout/useIsWide';
import { useMe } from '@/components/layout/useMe';
import { useActions } from '@/components/sheets/ActionsProvider';
import { ShareForm } from '@/components/sheets/ShareForm';
import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { Button, Card, IconButton, Pill } from '@/components/ui/Controls';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Stagger } from '@/components/ui/Stagger';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/auth';
import { AVAILABILITY } from '@/lib/labels';
import { useFeed, usePinnedAnnouncement, useTasks } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import { thisWeek } from '@/lib/time';
import { TOUR_SKIPPED_KEY } from '@/lib/tour';
import type { Availability, Post, Task } from '@/lib/types';
import { readCache } from '@/lib/useQuery';
import { useTheme } from '@/theme/ThemeProvider';

export default function Akis() {
  const wide = useIsWide();
  const me = useMe();
  const { profile } = useAuth();
  const team = useTeam();
  const feed = useFeed();
  const tasks = useTasks();
  const actions = useActions();
  // Aşağı çekip yenileyince yeni gelen paylaşımlar kısa bir süre a3 zeminle girer.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const allTasks = tasks.data ?? [];

  async function refresh() {
    const before = new Set((feed.data ?? []).map((p) => p.id));
    await Promise.all([feed.refetch(), tasks.refetch()]);
    const after = (readCache<Post[]>('feed') ?? []).map((p) => p.id);
    setFresh(new Set(after.filter((id) => !before.has(id))));
  }
  const stale = staleTaskFor(profile, allTasks);

  const open = allTasks.filter((t) => t.status !== 'bitti');
  const counts = {
    bende: open.filter((t) => t.assignee_id === team.meId).length,
    havuz: allTasks.filter((t) => t.status === 'havuz').length,
    blocked: open.filter((t) => t.needs_help).length,
  };

  const posts = feed.loading ? (
    <SkeletonCards count={3} />
  ) : feed.error ? (
    <ErrorState message={feed.error} onRetry={feed.refetch} />
  ) : (
    <Stagger gap={18}>
      {(feed.data ?? []).map((p) => (
        <PostCard key={p.id} post={p} fresh={fresh.has(p.id)} />
      ))}
      {feed.data?.length === 0 && (
        <EmptyState
          title="Akış şimdilik sakin"
          description="Üzerinde çalıştığın bir şeyi ilk sen paylaşabilirsin."
          action={{ label: '+ Süreç paylaş', onPress: () => actions.openShare() }}
        />
      )}
    </Stagger>
  );

  if (wide) {
    return (
      <Screen title="Akış" crumb="Ekipten son paylaşımlar">
        <View style={{ flexDirection: 'row', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <View style={{ flexGrow: 999, flexShrink: 1, flexBasis: 520, minWidth: 0, maxWidth: 700, gap: 18 }}>
            <Card radius={24} padding={18}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <Avatar person={me} size={40} />
                <View style={{ flex: 1 }}>
                  <ShareForm inline />
                </View>
              </View>
            </Card>
            <TourNote />
            {posts}
          </View>
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 300, maxWidth: 380, minWidth: 0, gap: 16 }}>
            <Card radius={22} gap={10}>
              <Txt weight={700}>Durumun</Txt>
              <AvailabilityChips compact />
            </Card>
            {stale && <TaskNudge task={stale} compact />}
            <ShareReminder me={profile} posts={feed.data ?? []} compact />
            <PinnedAnnouncement compact />
            <WeekCard counts={counts} doneThisWeek={doneThisWeek(allTasks)} />
            <PoolSuggestions tasks={allTasks} />
          </View>
        </View>
      </Screen>
    );
  }

  return <PhoneAkis counts={counts} stale={stale} posts={posts} onRefresh={refresh} />;
}

function PhoneAkis({
  counts,
  stale,
  posts,
  onRefresh,
}: {
  counts: { bende: number; havuz: number; blocked: number };
  stale: Task | undefined;
  posts: React.ReactNode;
  onRefresh: () => Promise<void>;
}) {
  const me = useMe();
  const { profile } = useAuth();
  const feed = useFeed();
  const actions = useActions();
  const { colors } = useTheme();

  const tile = (n: number, label: string, bg: 'a1' | 'a2' | 'a3', sekme: string) => (
    <Press
      onPress={() => router.navigate({ pathname: '/gorevler', params: { sekme } })}
      bg={bg}
      style={{ flex: 1, borderRadius: 22, padding: 14, gap: 2 }}
    >
      <Txt size={26} weight={700} color={`${bg}-ink`} leading={1.2} style={{ fontVariant: ['tabular-nums'] }}>
        {n}
      </Txt>
      <Txt size={13} weight={600} color={`${bg}-ink`}>
        {label}
      </Txt>
    </Press>
  );

  return (
    <Screen
      title="Akış"
      onRefresh={onRefresh}
      phoneTitle={`Hoş geldin, ${me.full_name}`}
      // Telefonda alt menüde Fikirler yok (6 sekme sınırı); Fikir Defteri buradan açılır.
      action={
        <Button
          label="Fikirler"
          icon="fikir"
          kind="soft"
          size="sm"
          onPress={() => router.navigate('/fikirler')}
        />
      }
    >
      <TourNote />
      <AvailabilityChips />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {tile(counts.bende, 'Bende', 'a1', 'bende')}
        {tile(counts.havuz, 'Havuzda', 'a2', 'havuz')}
        {tile(counts.blocked, 'Takılan iş', 'a3', 'tumu')}
      </View>
      {stale && <TaskNudge task={stale} />}
      <ShareReminder me={profile} posts={feed.data ?? []} />
      <PinnedAnnouncement />
      <Press
        onPress={() => router.navigate('/ozet')}
        bg="surface"
        shadow
        style={{
          borderRadius: 24,
          paddingVertical: 16,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <Box
          bg="a3"
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="chart" size={20} color={colors['a3-ink']} strokeWidth={2} />
        </Box>
        <View style={{ flex: 1 }}>
          <Txt weight={700}>Haftanın özeti hazır</Txt>
          <Txt size={13} color="muted">
            Bu hafta neler bitti, neler bekliyor
          </Txt>
        </View>
        <Icon name="chevron" size={20} color={colors.muted} strokeWidth={2} />
      </Press>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Txt size={20} weight={600} role="heading" style={{ flex: 1 }}>
          Ekipten
        </Txt>
        <IconButton icon="plus" label="Süreç paylaş" onPress={() => actions.openShare()} />
      </View>
      {posts}
    </Screen>
  );
}

/** Hoş geldin turu atlandıysa bir kez çıkan nazik not; kapatınca bir daha görünmez. */
function TourNote() {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(TOUR_SKIPPED_KEY)
      .then((v) => setShow(v === '1'))
      .catch(() => {});
  }, []);
  if (!show) return null;
  const close = () => {
    setShow(false);
    AsyncStorage.removeItem(TOUR_SKIPPED_KEY).catch(() => {});
  };
  return (
    <Box
      bg="a2"
      style={{
        borderRadius: 20,
        paddingVertical: 12,
        paddingLeft: 16,
        paddingRight: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Icon name="ekip" size={18} color={colors['a2-ink']} strokeWidth={2} />
      <Press onPress={() => router.navigate('/profil')} style={{ flex: 1 }} accessibilityRole="link">
        <Txt size={14.5} weight={600} color="a2-ink">
          Profilini istediğin zaman tamamlayabilirsin
        </Txt>
      </Press>
      <IconButton icon="close" label="Notu kapat" onPress={close} />
    </Box>
  );
}

/** Müsait / Az vaktim var / Molada seçimi. */
function AvailabilityChips({ compact }: { compact?: boolean }) {
  const { profile, updateProfile } = useAuth();
  const say = useToast();
  const current = profile?.availability ?? 'musait';

  async function pick(a: Availability) {
    if (a === current) return;
    const error = await updateProfile({ availability: a, availability_until: null });
    say(error ?? (a === 'ara' ? 'İyi dinlenmeler, burası seni bekler' : 'Durumun güncellendi'));
  }

  return (
    <View style={{ gap: compact ? 10 : 18 }}>
      <View style={{ flexDirection: 'row', gap: compact ? 6 : 8, flexWrap: 'wrap' }}>
        {(Object.keys(AVAILABILITY) as Availability[]).map((a) => (
          <Pill
            key={a}
            label={AVAILABILITY[a].label}
            dot={AVAILABILITY[a].color}
            size={compact ? 'sm' : 'md'}
            onSheet={compact}
            active={current === a}
            onPress={() => pick(a)}
          />
        ))}
      </View>
      {current === 'ara' && (
        <Txt size={13} color="muted" style={compact ? undefined : { marginTop: -8 }}>
          Molada olduğun sürece sana görev atanmaz, bildirim de gelmez.
          {compact ? '' : ' Dönünce tek dokunuşla geri gelirsin.'}
        </Txt>
      )}
    </View>
  );
}

function PinnedAnnouncement({ compact }: { compact?: boolean }) {
  const { data } = usePinnedAnnouncement();
  const team = useTeam();
  const { colors } = useTheme();
  if (!data) return null;
  return (
    <Box bg="a1" style={{ borderRadius: compact ? 22 : 24, padding: 18, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="pin" size={14} color={colors['a1-ink']} strokeWidth={2.2} />
        <Txt size={12} weight={700} color="a1-ink" style={{ letterSpacing: 0.72 }}>
          {(data.author_id
            ? `Sabit duyuru · ${team.nameOf(data.author_id)}`
            : 'Sabit duyuru'
          ).toLocaleUpperCase('tr')}
        </Txt>
      </View>
      <Txt size={18} weight={700} color="a1-ink" leading={1.3}>
        {data.title}
      </Txt>
      {!!data.body && (
        <Txt size={14} color="a1-ink">
          {data.body}
        </Txt>
      )}
    </Box>
  );
}

function doneThisWeek(tasks: Task[]) {
  const { start } = thisWeek();
  return tasks.filter((t) => t.status === 'bitti' && new Date(t.status_changed_at) >= start).length;
}

/** Bilgisayardaki "Bu hafta" kartı; basınca haftalık özet açılır. */
function WeekCard({
  counts,
  doneThisWeek: done,
}: {
  counts: { havuz: number; blocked: number };
  doneThisWeek: number;
}) {
  const tile = (n: number, label: string, bg: 'a1' | 'a2' | 'a3') => (
    <Box bg={bg} style={{ flex: 1, borderRadius: 14, padding: 10 }}>
      <Txt size={22} weight={700} color={`${bg}-ink`} leading={1.2} style={{ fontVariant: ['tabular-nums'] }}>
        {n}
      </Txt>
      <Txt size={12} weight={600} color={`${bg}-ink`}>
        {label}
      </Txt>
    </Box>
  );
  return (
    <Press
      onPress={() => router.navigate('/ozet')}
      bg="surface"
      shadow
      pressScale={0.97}
      style={{ borderRadius: 22, padding: 16, gap: 12 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Txt weight={700} style={{ flex: 1 }}>
          Bu hafta
        </Txt>
        <Txt size={12.5} color="muted">
          {thisWeek().label}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {tile(done, 'Biten', 'a1')}
        {tile(counts.blocked, 'Yardım bekleyen', 'a2')}
        {tile(counts.havuz, 'Havuzda', 'a3')}
      </View>
    </Press>
  );
}

/** "Havuzda senin için": alabileceğin ilk üç görev. */
function PoolSuggestions({ tasks }: { tasks: Task[] }) {
  const team = useTeam();
  const actions = useActions();
  const suggest = tasks.filter((t) => t.status === 'havuz' && team.canClaim(t)).slice(0, 3);
  return (
    <Card radius={22} gap={10}>
      <Txt weight={700}>Havuzda senin için</Txt>
      {suggest.length === 0 && (
        <Txt size={13.5} color="muted">
          Şu an alabileceğin görev yok.
        </Txt>
      )}
      {suggest.map((t) => (
        <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={12} weight={600} color={t.project_id ? 'accent-text' : 'muted'}>
              {t.project_id ? team.projectMap.get(t.project_id)?.name : 'Projesiz'}
            </Txt>
            <Txt size={14.5} weight={600}>
              {t.title}
            </Txt>
          </View>
          <Button label="Ben alırım" size="sm" onPress={() => actions.claim(t)} />
        </View>
      ))}
    </Card>
  );
}
