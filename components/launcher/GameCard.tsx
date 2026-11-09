// Oyun kartı (ana sayfa, 3 sütun) ve kapak. Üzerine gelince hafifçe yükselir.

import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Controls';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { friendlyError } from '@/lib/errors';
import {
  formatSize,
  gameAction,
  installGame,
  playGame,
  useGameState,
  type Game,
  type GameAction,
} from '@/lib/launcher/games';
import { EASE_OUT, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import type { Palette } from '@/theme/themes';

import { GradientBar, Tag } from './parts';

/** Kapak görseli; yoksa oyunun adından renk seçilip logolu bir kapak çizilir. */
export function GameCover({ game, height }: { game: Game; height: number }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const tints = [colors.a1, colors.a2, colors.a3];
  const inks = [colors['a1-ink'], colors['a2-ink'], colors['a3-ink']];
  const k = [...game.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 3;
  return (
    <View style={{ height, backgroundColor: tints[k], overflow: 'hidden' }}>
      {game.kapak && !failed ? (
        <Image
          source={{ uri: game.kapak }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={300}
          onError={() => setFailed(true)}
          accessibilityLabel={`${game.ad} kapak görseli`}
        />
      ) : (
        // Kapak yoksa: oyunun renginde zemin, üstünde soluk logo (ad zaten kartın altında yazıyor).
        <View style={{ flex: 1 }} accessibilityLabel={`${game.ad} kapak görseli`}>
          <View style={{ position: 'absolute', right: -30, top: -20, opacity: 0.14 }}>
            <Logo size={height * 1.15} color={inks[k]} />
          </View>
        </View>
      )}
    </View>
  );
}

export function statusTag(game: Game, action: GameAction, colors: Palette) {
  if (action === 'guncelle') return { label: 'Güncelleme var', bg: colors.a1, fg: colors['a1-ink'] };
  if (action === 'oyna' || action === 'oynaniyor')
    return { label: 'Kurulu', bg: colors.a3, fg: colors['a3-ink'] };
  if (game.durum === 'yakinda') return { label: 'Yakında', bg: colors.a2, fg: colors['a2-ink'] };
  if (game.durum === 'beklemede') return { label: 'Beklemede', bg: colors.surface2, fg: colors['text-3'] };
  return { label: 'Yayında', bg: colors['sel-bg'], fg: colors['sel-fg'] };
}

/** Kartın ana eylemi: İndir / Güncelle / Oyna / Oynanıyor / Yakında / Beklemede; inerken ilerleme çubuğu. */
export function GameButton({ game, compact }: { game: Game; compact?: boolean }) {
  const state = useGameState();
  const say = useToast();
  const action = gameAction(game, state);
  const dl = state.downloads[game.id];
  const size = compact ? 'sm' : 'md';

  if (action === 'indiriliyor' && dl) {
    const p = dl.total ? (dl.received / dl.total) * 100 : 0;
    const label =
      dl.phase === 'dogrulaniyor'
        ? 'Doğrulanıyor…'
        : dl.phase === 'cikariliyor'
          ? 'Kuruluyor…'
          : dl.phase === 'duraklatildi'
            ? `Duraklatıldı · %${Math.round(p)}`
            : dl.phase === 'hata'
              ? 'İndirilemedi'
              : `%${Math.round(p)}`;
    return (
      <View style={{ gap: 6, minWidth: compact ? 150 : undefined, flex: compact ? undefined : 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt size={12.5} weight={700} color="muted" style={{ fontVariant: ['tabular-nums'] }}>
            {label}
          </Txt>
          {dl.phase === 'indiriliyor' && dl.speed > 0 && (
            <Txt size={12.5} weight={600} color="faint" style={{ fontVariant: ['tabular-nums'] }}>
              {formatSize(dl.speed)}/sn
            </Txt>
          )}
        </View>
        <GradientBar progress={dl.phase === 'dogrulaniyor' || dl.phase === 'cikariliyor' ? 100 : p} />
      </View>
    );
  }

  const run = (fn: () => Promise<unknown>) => () =>
    fn().catch((e) => say(friendlyError(e, 'Şu an olmadı. Biraz sonra tekrar dene.')));
  switch (action) {
    case 'indir':
      return (
        <Button
          label={game.boyut ? `İndir · ${formatSize(game.boyut)}` : 'İndir'}
          icon="download"
          size={size}
          onPress={run(() => installGame(game))}
        />
      );
    case 'guncelle':
      return <Button label="Güncelle" icon="refresh" size={size} onPress={run(() => installGame(game))} />;
    case 'oyna':
      return <Button label="Oyna" icon="play" size={size} onPress={run(() => playGame(game))} />;
    case 'oynaniyor':
      return <Button label="Oynanıyor" kind="cyan" size={size} disabled />;
    case 'yakinda':
      return <Button label="Yakında" kind="muted" size={size} disabled />;
    default:
      return <Button label="Beklemede" kind="muted" size={size} disabled />;
  }
}

export function GameCard({ game }: { game: Game }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const state = useGameState();
  const [hover, setHover] = useState(false);
  const tag = statusTag(game, gameAction(game, state), colors);

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          minWidth: 0,
          borderRadius: 22,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          transform: [{ translateY: hover ? -4 : 0 }],
          boxShadow: hover ? '0 14px 34px rgba(0,0,0,0.22)' : `0 0 0 1px ${colors.line}`,
        },
        motion.transition(['transform', 'boxShadow'], 300, EASE_OUT),
      ]}
    >
      <Press
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        pressScale={1}
        accessibilityRole="none"
        style={{ cursor: 'auto' }}
      >
        <View>
          <GameCover game={game} height={150} />
          <View style={{ position: 'absolute', left: 12, top: 12 }}>
            <Tag {...tag} />
          </View>
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ gap: 2 }}>
            <Txt size={17} weight={800} numberOfLines={1}>
              {game.ad}
            </Txt>
            <Txt size={13} color="muted" numberOfLines={1}>
              {game.tur}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <GameButton game={game} />
          </View>
        </View>
      </Press>
    </Animated.View>
  );
}
