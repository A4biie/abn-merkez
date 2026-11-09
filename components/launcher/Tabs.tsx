// Launcher sekmeleri: Oyunlar, İndirmeler, Ayarlar.

import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { EmptyState } from '@/components/EmptyState';
import { LogoLoader } from '@/components/LogoLoader';
import { NotifySettings } from '@/components/notify/NotifySettings';
import { ThemeList } from '@/components/ThemePicker';
import { Button, IconButton, Pill } from '@/components/ui/Controls';
import { Bone, ErrorState } from '@/components/ui/Feedback';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Switch } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { isDesktop, useLauncherVersion } from '@/lib/desktop';
import { friendlyError } from '@/lib/errors';
import {
  cancelGame,
  formatSize,
  gameAction,
  openGameFolder,
  pauseGame,
  resumeGame,
  uninstallGame,
  useGames,
  useGameState,
  verifyGame,
  type Download,
  type Game,
} from '@/lib/launcher/games';
import { pickInstallDir, setSetting, useSettings } from '@/lib/launcher/settings';
import { checkForUpdate, useLauncherUpdate } from '@/lib/launcher/updater';
import { APP_VERSION } from '@/lib/version';
import { EASE_SPRING, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

import { GameButton, GameCover, statusTag } from './GameCard';
import { GradientBar, riseIn, ufInKF } from './parts';

function TabHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={28} weight={800} role="heading">
          {title}
        </Txt>
        {!!sub && (
          <Txt size={14} color="muted">
            {sub}
          </Txt>
        )}
      </View>
      {right}
    </View>
  );
}

// ── Oyunlar ──

type Filter = 'tumu' | 'kurulu' | 'yakinda';

export function GamesTab() {
  const games = useGames();
  const state = useGameState();
  const motion = useMotion();
  const [filter, setFilter] = useState<Filter>('tumu');
  const all = games.data ?? [];
  const list = all.filter((g) =>
    filter === 'kurulu' ? !!state.installed[g.id] : filter === 'yakinda' ? g.durum === 'yakinda' : true,
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 28, gap: 20 }}>
      <TabHeader
        title="Oyunlar"
        sub="ABN'nin oyunları ve demoları"
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(
              [
                ['tumu', 'Tümü'],
                ['kurulu', 'Kurulu'],
                ['yakinda', 'Yakında'],
              ] as [Filter, string][]
            ).map(([k, label]) => (
              <Pill key={k} label={label} active={filter === k} onPress={() => setFilter(k)} />
            ))}
          </View>
        }
      />
      {games.loading ? (
        [0, 1, 2].map((i) => <Bone key={i} h={92} r={20} />)
      ) : games.error ? (
        <ErrorState
          message="Oyun listesi alınamadı. İnternet bağlantını kontrol et."
          onRetry={games.refetch}
        />
      ) : list.length === 0 ? (
        <EmptyState
          title={
            filter === 'kurulu'
              ? 'Kurulu oyun yok'
              : filter === 'yakinda'
                ? 'Yakında çıkacak oyun yok'
                : 'Henüz oyun yok'
          }
          description={
            filter === 'kurulu'
              ? 'Bir oyunu indirince burada görünür.'
              : 'Yeni bir oyun ya da demo gelince burada görünecek.'
          }
          action={
            filter !== 'tumu' ? { label: 'Tümünü göster', onPress: () => setFilter('tumu') } : undefined
          }
        />
      ) : (
        list.map((g, i) => (
          <Animated.View key={g.id} style={[riseIn(motion, i), { zIndex: list.length - i }]}>
            <GameRow game={g} />
          </Animated.View>
        ))
      )}
    </ScrollView>
  );
}

function GameRow({ game }: { game: Game }) {
  const { colors } = useTheme();
  const state = useGameState();
  const action = gameAction(game, state);
  const tag = statusTag(game, action, colors);
  const installed = state.installed[game.id];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 12,
        paddingRight: 16,
      }}
    >
      <View style={{ width: 132, borderRadius: 14, overflow: 'hidden' }}>
        <GameCover game={game} height={74} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt size={16.5} weight={800} numberOfLines={1} style={{ flexShrink: 1 }}>
            {game.ad}
          </Txt>
          <View
            style={{ backgroundColor: tag.bg, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}
          >
            <Txt size={11.5} weight={800} style={{ color: tag.fg }}>
              {tag.label}
            </Txt>
          </View>
        </View>
        <Txt size={13} color="muted" numberOfLines={1}>
          {game.tur}
          {' · '}
          {installed ? `Kurulu ${installed.version}` : `Sürüm ${game.surum}`}
          {game.boyut ? ` · ${formatSize(game.boyut)}` : ''}
        </Txt>
      </View>
      <GameButton game={game} compact />
      {installed && action !== 'indiriliyor' && <GameMenu game={game} />}
    </View>
  );
}

/** Kurulu oyunun "⋯" menüsü: Klasörü aç, Doğrula, Kaldır (kaldırmadan önce onay ister). */
function GameMenu({ game }: { game: Game }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const say = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    setConfirm(false);
  };
  const item = (icon: IconName, label: string, onPress: () => void, danger?: boolean) => (
    <Press
      key={label}
      onPress={onPress}
      hoverBg="hover"
      pressScale={0.98}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
      }}
    >
      <Icon name={icon} size={17} color={danger ? colors['warn-text'] : colors['text-2']} strokeWidth={2} />
      <Txt size={14} weight={600} color={danger ? 'warn-text' : 'text-2'}>
        {label}
      </Txt>
    </Press>
  );

  return (
    <View>
      <IconButton
        icon="more"
        label={`${game.ad} için diğer işlemler`}
        kind="muted"
        size={38}
        onPress={() => (open ? close() : setOpen(true))}
      />
      {open && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              right: 0,
              top: 44,
              width: 220,
              padding: 6,
              borderRadius: 16,
              backgroundColor: colors.surface,
              boxShadow: `0 0 0 1px ${colors.line}, 0 18px 40px rgba(0,0,0,0.28)`,
              zIndex: 20,
            },
            riseIn(motion, 0),
          ]}
        >
          {!confirm ? (
            <>
              {item('folder', 'Klasörü aç', () => {
                close();
                openGameFolder(game.id).catch((e) => say(friendlyError(e)));
              })}
              {item('shieldCheck', busy ? 'Doğrulanıyor…' : 'Doğrula', async () => {
                setBusy(true);
                try {
                  const ok = await verifyGame(game.id);
                  say(ok ? 'Dosyalar sağlam' : 'Bazı dosyalar eksik ya da bozuk. Yeniden indirmeyi dene.');
                } catch (e) {
                  say(friendlyError(e));
                } finally {
                  setBusy(false);
                  close();
                }
              })}
              {item('trash', 'Kaldır', () => setConfirm(true), true)}
            </>
          ) : (
            <View style={{ padding: 8, gap: 10 }}>
              <Txt size={14} weight={700}>
                {game.ad} kaldırılsın mı?
              </Txt>
              <Txt size={13} color="muted">
                Oyun dosyaları silinir. Kayıtların oyunun kendi klasöründeyse onlar da gider.
              </Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button label="Vazgeç" kind="soft" size="sm" onPress={close} />
                <Button
                  label="Kaldır"
                  kind="sel"
                  size="sm"
                  onPress={() => {
                    close();
                    uninstallGame(game.id)
                      .then(() => say(`${game.ad} kaldırıldı`))
                      .catch((e) => say(friendlyError(e)));
                  }}
                />
              </View>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

// ── İndirmeler ──

export function DownloadsTab({ onGames }: { onGames: () => void }) {
  const state = useGameState();
  const games = useGames();
  const list = Object.values(state.downloads);

  return (
    <ScrollView contentContainerStyle={{ padding: 28, gap: 16, flexGrow: 1 }}>
      <TabHeader title="İndirmeler" sub={list.length ? `${list.length} indirme sürüyor` : undefined} />
      {list.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            title="Şu an inen bir şey yok"
            description="Bir oyunu indirince ilerlemesi burada görünür."
            action={{ label: 'Oyunlara göz at', onPress: onGames }}
          />
        </View>
      ) : (
        list.map((d, i) => (
          <DownloadCard key={d.id} d={d} index={i} game={(games.data ?? []).find((g) => g.id === d.id)} />
        ))
      )}
    </ScrollView>
  );
}

function DownloadCard({ d, index, game }: { d: Download; index: number; game?: Game }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const p = d.total ? (d.received / d.total) * 100 : 0;
  const left = d.speed > 0 ? Math.max(1, Math.round((d.total - d.received) / d.speed)) : null;
  const sub =
    d.phase === 'dogrulaniyor'
      ? 'Dosya doğrulanıyor…'
      : d.phase === 'cikariliyor'
        ? 'Kuruluyor…'
        : d.phase === 'duraklatildi'
          ? `Duraklatıldı · ${formatSize(d.received)} / ${formatSize(d.total)}`
          : d.phase === 'hata'
            ? (d.error ?? 'İndirilemedi')
            : `${formatSize(d.received)} / ${formatSize(d.total)} · ${formatSize(d.speed)}/sn${left ? ` · ${left < 60 ? `${left} sn` : `${Math.ceil(left / 60)} dk`}` : ''}`;
  const busy = d.phase === 'indiriliyor' || d.phase === 'dogrulaniyor' || d.phase === 'cikariliyor';

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          backgroundColor: colors.surface,
          borderRadius: 20,
          padding: 16,
          boxShadow: `0 0 0 1px ${colors.line}`,
        },
        motion.reduced
          ? null
          : {
              animationName: ufInKF,
              animationDuration: 550,
              animationDelay: index * 120,
              animationTimingFunction: EASE_SPRING,
              animationFillMode: 'both',
            },
      ]}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: colors.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {busy ? (
          <LogoLoader size="md" label={`${d.name} iniyor`} />
        ) : (
          <LogoLoader size="md" progress={p / 100} label={`${d.name}, yüzde ${Math.round(p)}`} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <Txt size={15} weight={800} numberOfLines={1} style={{ flexShrink: 1 }}>
            {d.name} {d.version}
          </Txt>
          <Txt size={13} weight={800} style={{ fontVariant: ['tabular-nums'] }}>
            %{Math.round(d.phase === 'dogrulaniyor' || d.phase === 'cikariliyor' ? 100 : p)}
          </Txt>
        </View>
        {/* Dosya yükleme kartındaki üç renkli çubuk */}
        <GradientBar progress={d.phase === 'dogrulaniyor' || d.phase === 'cikariliyor' ? 100 : p} />
        <Txt
          size={12.5}
          weight={600}
          color={d.phase === 'hata' ? 'warn-text' : 'muted'}
          numberOfLines={1}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {sub}
        </Txt>
      </View>
      {d.phase === 'indiriliyor' && (
        <IconButton icon="pause" label="Duraklat" kind="muted" size={40} onPress={() => pauseGame(d.id)} />
      )}
      {(d.phase === 'duraklatildi' || d.phase === 'hata') && game && (
        <IconButton
          icon={d.phase === 'hata' ? 'refresh' : 'play'}
          label={d.phase === 'hata' ? 'Tekrar dene' : 'Devam et'}
          kind="muted"
          size={40}
          onPress={() => resumeGame(game)}
        />
      )}
      {d.phase !== 'dogrulaniyor' && d.phase !== 'cikariliyor' && (
        <IconButton icon="close" label="İptal et" kind="muted" size={40} onPress={() => cancelGame(d.id)} />
      )}
    </Animated.View>
  );
}

// ── Ayarlar ──

export function SettingsTab() {
  const { colors } = useTheme();
  const say = useToast();
  const s = useSettings();
  const launcher = useLauncherVersion();
  const update = useLauncherUpdate();
  const games = useGames();
  const [checked, setChecked] = useState<string | null>(null);

  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) =>
    setSetting(k, v).catch((e) => say(friendlyError(e)));

  async function checkNow() {
    setChecked(null);
    const [found] = await Promise.all([checkForUpdate(), games.refetch()]);
    setChecked(found ? 'Yeni sürüm bulundu. Ana sayfadaki karttan kurabilirsin.' : 'Her şey güncel.');
  }

  const row = (title: string, sub: string, control: React.ReactNode) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={15} weight={700}>
          {title}
        </Txt>
        <Txt size={13} color="muted">
          {sub}
        </Txt>
      </View>
      {control}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 28, gap: 24, maxWidth: 820 }}>
      <TabHeader title="Ayarlar" />
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 22,
          paddingHorizontal: 20,
          paddingVertical: 4,
        }}
      >
        {row(
          'Bilgisayar açılınca başlat',
          'Windows açılırken sessizce tepside başlar.',
          <Switch
            label="Bilgisayar açılınca başlat"
            value={s.autostart}
            onChange={(v) => set('autostart', v)}
          />,
        )}
        {row(
          'Kapatınca tepsiye indir',
          "Kapat butonu launcher'ı kapatmaz; saatin yanındaki simgede bekler.",
          <Switch
            label="Kapatınca tepsiye indir"
            value={s.closeToTray}
            onChange={(v) => set('closeToTray', v)}
          />,
        )}
        {row(
          'Güncellemeleri otomatik indir',
          'Launcher ve oyun güncellemeleri arka planda iner.',
          <Switch
            label="Güncellemeleri otomatik indir"
            value={s.autoUpdate}
            onChange={(v) => set('autoUpdate', v)}
          />,
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 }}>
          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <Txt size={15} weight={700}>
              Kurulum klasörü
            </Txt>
            <Txt size={13} color="muted" numberOfLines={1} style={{ fontFamily: 'monospace' }}>
              {s.installDir}
            </Txt>
          </View>
          <Button
            label="Değiştir"
            kind="soft"
            size="sm"
            icon="folder"
            disabled={!isDesktop}
            onPress={async () => {
              const dir = await pickInstallDir().catch(() => null);
              if (dir) set('installDir', dir);
            }}
          />
        </View>
      </View>

      <NotifySettings />

      <View style={{ gap: 12 }}>
        <Txt size={17} weight={800}>
          Tema
        </Txt>
        <ThemeList title={false} />
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 20, gap: 12 }}>
        <Txt size={17} weight={800}>
          Güncellemeler
        </Txt>
        <Txt size={14} color="muted" style={{ fontVariant: ['tabular-nums'] }}>
          ABN Launcher {launcher ?? '…'} · ABN Merkez {APP_VERSION}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Button
            label={update.phase === 'checking' ? 'Kontrol ediliyor…' : 'Şimdi kontrol et'}
            icon="refresh"
            kind="soft"
            onPress={checkNow}
            disabled={update.phase === 'checking'}
          />
          {update.phase === 'checking' && <LogoLoader size="sm" />}
          {!!checked && update.phase !== 'checking' && (
            <Txt size={13.5} weight={600} color="text-3">
              {checked}
            </Txt>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
