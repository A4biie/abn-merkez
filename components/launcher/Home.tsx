// Launcher ana sayfası: büyük ABN Merkez kartı, oyun kartları (3 sütun) ve sağda 312 px "Haberler".

import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { EmptyState } from '@/components/EmptyState';
import { Logo } from '@/components/Logo';
import { LogoLoader } from '@/components/LogoLoader';
import { Button } from '@/components/ui/Controls';
import { Bone, ErrorState } from '@/components/ui/Feedback';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Sheet } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/auth';
import { LAUNCHER_RELEASES, RELEASES, type Release } from '@/lib/changelog';
import { useLauncherVersion } from '@/lib/desktop';
import { formatSize, useGames, type Game } from '@/lib/launcher/games';
import { openMerkez, useMerkezWindow } from '@/lib/launcher/merkez';
import { downloadUpdate, installAndRelaunch, useLauncherUpdate } from '@/lib/launcher/updater';
import { usePinnedAnnouncement } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/time';
import { useQuery } from '@/lib/useQuery';
import { APP_VERSION } from '@/lib/version';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

import { GameCard } from './GameCard';
import { bobKF, Dots, GradientBar, lwBusyKF, riseIn, Tag } from './parts';

export function HomeTab({ onGames }: { onGames: () => void }) {
  const games = useGames();
  const motion = useMotion();
  const list = (games.data ?? []).slice(0, 3);

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 28, gap: 26 }}>
        <Animated.View style={riseIn(motion, 0)}>
          <MerkezCard />
        </Animated.View>
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Txt size={20} weight={800} role="heading" style={{ flex: 1 }}>
              Oyunlar
            </Txt>
            {(games.data?.length ?? 0) > 3 && (
              <Button label="Tümünü gör" kind="soft" size="sm" onPress={onGames} />
            )}
          </View>
          {games.loading ? (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ flex: 1, gap: 10 }}>
                  <Bone h={150} r={22} />
                  <Bone w="60%" />
                  <Bone w="40%" h={12} />
                </View>
              ))}
            </View>
          ) : games.error ? (
            <ErrorState
              message="Oyun listesi alınamadı. İnternet bağlantını kontrol et."
              onRetry={games.refetch}
            />
          ) : list.length === 0 ? (
            <EmptyState
              title="Henüz oyun yok"
              description="İlk demo yayınlanınca burada görünecek. Acelesi yok."
            />
          ) : (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {list.map((g, i) => (
                <Animated.View key={g.id} style={[{ flex: 1, minWidth: 0 }, riseIn(motion, i + 1)]}>
                  <GameCard game={g} />
                </Animated.View>
              ))}
              {Array.from({ length: 3 - list.length }, (_, i) => (
                <View key={`bos-${i}`} style={{ flex: 1 }} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <News games={games.data ?? []} />
    </View>
  );
}

// ── ABN Merkez kartı ──

function MerkezCard() {
  const { colors } = useTheme();
  const motion = useMotion();
  const update = useLauncherUpdate();
  const merkez = useMerkezWindow();
  const [notes, setNotes] = useState(false);

  // Süzülen kart şekilleri (dosyadaki .lw-app .hero şekilleri; bobP salınımıyla).
  const shapes = [
    { right: 40, top: 34, width: 150, height: 100, bg: colors.a1, delay: 0 },
    { right: 116, top: 98, width: 132, height: 98, bg: colors.a2, delay: -1200 },
    { right: 26, top: 150, width: 116, height: 66, bg: colors.a3, delay: -2400 },
  ];

  return (
    <View
      style={{
        height: 280,
        borderRadius: 28,
        backgroundColor: colors.bg,
        overflow: 'hidden',
        boxShadow: `0 0 0 1px ${colors.line}`,
      }}
    >
      <Dots />
      <View pointerEvents="none" style={{ position: 'absolute', right: -40, bottom: -120, opacity: 0.05 }}>
        <Logo size={420} />
      </View>
      {shapes.map((s, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              right: s.right,
              top: s.top,
              width: s.width,
              height: s.height,
              borderRadius: 16,
              backgroundColor: s.bg,
            },
            motion.reduced
              ? null
              : {
                  animationName: bobKF,
                  animationDuration: 3600,
                  animationDelay: s.delay,
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out',
                },
          ]}
        />
      ))}
      <View style={{ flex: 1, justifyContent: 'flex-end', padding: 28, gap: 10, maxWidth: '62%' }}>
        <Tag label={`Merkez ${APP_VERSION}`} bg={colors.surface} fg={colors['text-3']} />
        <Txt size={36} weight={800} leading={1.05} role="heading">
          ABN Merkez
        </Txt>
        <Txt size={15} color="muted" style={{ maxWidth: 420 }}>
          Ekibin projeleri, fikirleri ve panoları bir arada. Masaüstünde, bildirimleriyle.
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'center' }}>
          <MainButton update={update} open={merkez.open} />
          <Button label="Neler yeni" kind="soft" size="lg" onPress={() => setNotes(true)} />
        </View>
      </View>
      <WhatsNewPanel open={notes} onClose={() => setNotes(false)} />
    </View>
  );
}

function MainButton({ update, open }: { update: ReturnType<typeof useLauncherUpdate>; open: boolean }) {
  const { colors } = useTheme();
  const motion = useMotion();

  if (update.phase === 'downloading') {
    return (
      <View
        style={{
          width: 240,
          height: 50,
          borderRadius: 999,
          backgroundColor: colors.surface,
          paddingHorizontal: 20,
          justifyContent: 'center',
          gap: 7,
        }}
        accessibilityLabel={`Güncelleme indiriliyor, yüzde ${Math.round(update.progress)}`}
      >
        <Txt size={13} weight={800} style={{ fontVariant: ['tabular-nums'] }}>
          İndiriliyor · %{Math.round(update.progress)}
        </Txt>
        <GradientBar progress={update.progress} height={4} track="line-2" />
      </View>
    );
  }
  if (update.phase === 'ready')
    return <Button label="Yeniden başlat ve aç" icon="refresh" size="lg" onPress={installAndRelaunch} />;
  if (update.phase === 'available')
    return (
      <Button
        label={update.size ? `Güncelle · ${formatSize(update.size)}` : 'Güncelle'}
        icon="download"
        size="lg"
        onPress={downloadUpdate}
      />
    );
  if (open)
    return (
      <Animated.View
        style={
          motion.reduced
            ? null
            : {
                animationName: lwBusyKF,
                animationDuration: 2200,
                animationIterationCount: 'infinite',
                animationTimingFunction: 'ease-in-out',
              }
        }
      >
        <Button label="Açık · öne getir" kind="cyan" size="lg" onPress={() => openMerkez()} />
      </Animated.View>
    );
  return <Button label="Merkez'i aç" iconRight="arrow" size="lg" onPress={() => openMerkez()} />;
}

/** "Neler yeni": CHANGELOG'dan Launcher ve Merkez sürümleri. */
function WhatsNewPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const launcher = useLauncherVersion();
  return (
    <Sheet open={open} onClose={onClose} label="Neler yeni">
      <View style={{ gap: 18 }}>
        <Txt size={22} weight={800}>
          Neler yeni
        </Txt>
        {LAUNCHER_RELEASES.length > 0 && (
          <ReleaseList
            title={`ABN Launcher${launcher ? ` · ${launcher}` : ''}`}
            releases={LAUNCHER_RELEASES.slice(0, 2)}
          />
        )}
        <ReleaseList title={`ABN Merkez · ${APP_VERSION}`} releases={RELEASES.slice(0, 2)} />
        <Button label="Tamam" onPress={onClose} />
      </View>
    </Sheet>
  );
}

function ReleaseList({ title, releases }: { title: string; releases: Release[] }) {
  return (
    <View style={{ gap: 10 }}>
      <Txt size={13} weight={800} color="faint" style={{ textTransform: 'uppercase', letterSpacing: 1.2 }}>
        {title}
      </Txt>
      {releases.map((r) => (
        <View key={r.version} style={{ gap: 6 }}>
          <Txt weight={800}>
            {r.version}
            {r.date ? <Txt color="muted"> · {r.date}</Txt> : null}
          </Txt>
          {r.sections.map((s) => (
            <View key={s.title} style={{ gap: 4 }}>
              <Txt size={12.5} weight={700} color="accent-text">
                {s.title}
              </Txt>
              {s.items.map((it) => (
                <Txt key={it} size={14} color="text-2">
                  · {it}
                </Txt>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Haberler ──

type BoardMove = {
  id: string;
  type: string;
  updated_at: string;
  board: { id: string; title: string } | null;
  author: { full_name: string } | null;
};

async function fetchBoardMoves(): Promise<BoardMove[]> {
  const { data, error } = await supabase
    .from('board_items')
    .select(
      'id, type, updated_at, board:boards(id, title), author:profiles!board_items_created_by_fkey(full_name)',
    )
    .order('updated_at', { ascending: false })
    .limit(4);
  if (error) throw error;
  return (data ?? []) as unknown as BoardMove[];
}

const ITEM_NAMES: Record<string, string> = {
  note: 'not',
  todo: 'yapılacaklar',
  image: 'görsel',
  color: 'renk',
  link: 'bağlantı',
  zone: 'bölge',
  sketch: 'çizim',
  table: 'tablo',
  file: 'dosya',
  board: 'alt pano',
  heading: 'başlık',
  quote: 'alıntı',
  video: 'video',
};

function News({ games }: { games: Game[] }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const { session } = useAuth();
  const ann = usePinnedAnnouncement();
  const moves = useQuery(session ? 'launcher-board-moves' : null, fetchBoardMoves);
  const releases = [
    ...LAUNCHER_RELEASES.slice(0, 1).map((r) => ({ ...r, app: 'Launcher' })),
    ...RELEASES.slice(0, 1).map((r) => ({ ...r, app: 'Merkez' })),
  ];
  const gameNews = games
    .filter((g) => g.tarih && g.durum === 'yayinda')
    .sort((a, b) => (b.tarih ?? '').localeCompare(a.tarih ?? ''))
    .slice(0, 3);

  return (
    <View
      style={{ width: 312, borderLeftWidth: 1, borderLeftColor: colors.line, backgroundColor: colors.nav }}
    >
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        <Txt size={20} weight={800} role="heading">
          Haberler
        </Txt>

        {!session ? (
          <NewsCard icon="pin" title="Merkez'e giriş yap" index={0} motion={motion}>
            <Txt size={13.5} color="muted">
              Duyurular ve pano hareketleri giriş yapınca burada görünür.
            </Txt>
            <Button
              label="Giriş yap"
              kind="soft"
              size="sm"
              onPress={() => openMerkez('/giris')}
              style={{ alignSelf: 'flex-start', marginTop: 4 }}
            />
          </NewsCard>
        ) : ann.loading ? (
          <Bone h={96} r={18} />
        ) : ann.data ? (
          <NewsCard
            icon="pin"
            title="Sabit duyuru"
            index={0}
            motion={motion}
            tint={colors.a3}
            onPress={() => openMerkez('/akis')}
          >
            <Txt size={14.5} weight={800}>
              {ann.data.title}
            </Txt>
            <Txt size={13.5} color="text-3" numberOfLines={3}>
              {ann.data.body}
            </Txt>
          </NewsCard>
        ) : null}

        <NewsCard icon="refresh" title="Son güncellemeler" index={1} motion={motion}>
          {releases.map((r) => (
            <View key={r.app + r.version} style={{ gap: 2 }}>
              <Txt size={13.5} weight={800}>
                {r.app} {r.version}
              </Txt>
              <Txt size={13} color="muted" numberOfLines={2}>
                {r.sections[0]?.items[0] ?? ''}
              </Txt>
            </View>
          ))}
        </NewsCard>

        {session && (
          <NewsCard icon="pano" title="Pano hareketleri" index={2} motion={motion}>
            {moves.loading ? (
              <LogoLoader size="sm" />
            ) : (moves.data ?? []).length === 0 ? (
              <Txt size={13} color="muted">
                Panolarda henüz hareket yok.
              </Txt>
            ) : (
              (moves.data ?? []).map((m) => (
                <Press
                  key={m.id}
                  onPress={() => openMerkez(m.board ? `/panolar?pano=${m.board.id}` : '/panolar')}
                  style={{ gap: 1 }}
                >
                  <Txt size={13.5} weight={700} numberOfLines={1}>
                    {m.board?.title ?? 'Pano'}
                  </Txt>
                  <Txt size={12.5} color="muted" numberOfLines={1}>
                    {(m.author?.full_name ?? 'Biri').split(' ')[0]} bir {ITEM_NAMES[m.type] ?? 'kart'} ekledi
                    · {timeAgo(m.updated_at)}
                  </Txt>
                </Press>
              ))
            )}
          </NewsCard>
        )}

        {gameNews.length > 0 && (
          <NewsCard icon="oyun" title="Oyun sürümleri" index={3} motion={motion}>
            {gameNews.map((g) => (
              <View key={g.id} style={{ gap: 1 }}>
                <Txt size={13.5} weight={700}>
                  {g.ad} {g.surum}
                </Txt>
                <Txt size={12.5} color="muted">
                  {timeAgo(g.tarih ?? '')}
                </Txt>
              </View>
            ))}
          </NewsCard>
        )}
      </ScrollView>
    </View>
  );
}

function NewsCard({
  icon,
  title,
  children,
  index,
  motion,
  tint,
  onPress,
}: {
  icon: IconName;
  title: string;
  children: React.ReactNode;
  index: number;
  motion: ReturnType<typeof useMotion>;
  tint?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const body = (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Icon name={icon} size={15} color={tint ?? colors.faint} strokeWidth={2.2} />
        <Txt size={12} weight={800} color="faint" style={{ textTransform: 'uppercase', letterSpacing: 1.1 }}>
          {title}
        </Txt>
      </View>
      {children}
    </View>
  );
  return (
    <Animated.View
      style={[{ backgroundColor: colors.surface, borderRadius: 18, padding: 14 }, riseIn(motion, index + 1)]}
    >
      {onPress ? (
        <Press onPress={onPress} pressScale={0.98} accessibilityLabel={title}>
          {body}
        </Press>
      ) : (
        body
      )}
    </Animated.View>
  );
}
