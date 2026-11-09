import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { EmptyState } from '@/components/EmptyState';

import { Screen } from '@/components/layout/Screen';
import { useIsWide } from '@/components/layout/useIsWide';
import { Button, Field } from '@/components/ui/Controls';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { createBoard, estimateHeight, useBoards, type BoardWithItems, type Tint } from '@/lib/board';
import { friendlyError } from '@/lib/errors';
import { useTeam } from '@/lib/team';
import { css, EASE_OUT, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { swatch, TINT_ORDER, TINTS } from './tints';

export function openBoard(id: string) {
  router.navigate({ pathname: '/panolar', params: { pano: id } });
}

/** Panolar sekmesinin ilk ekranı: üst düzey panoların listesi (Board.dc.html "Pano listesi"). */
export function BoardList() {
  const wide = useIsWide();
  const boards = useBoards();
  const [creating, setCreating] = useState(false);
  const all = boards.data ?? [];
  const top = all.filter((b) => !b.parent_board_id);

  return (
    <Screen title="Panolar" crumb="Referans, taslak, hikâye akışı" wideAction={<View />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight={700}>{boards.loading || top.length === 0 ? 'Panolar' : `${top.length} pano`}</Txt>
          <Txt size={13.5} color="muted">
            {!boards.loading && top.length === 0 ? 'Referans, taslak, hikâye akışı' : 'Bir panoya dokun, içine gir.'}
          </Txt>
        </View>
        <Button label="Yeni pano" kind="sel" icon="plus" onPress={() => setCreating((c) => !c)} />
      </View>

      {creating && <CreateForm onClose={() => setCreating(false)} />}

      {boards.loading ? (
        <SkeletonCards count={2} lines={2} />
      ) : boards.error ? (
        <ErrorState message={boards.error} onRetry={boards.refetch} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: wide ? 18 : 12 }}>
          {top.map((b) => (
            <BoardTile key={b.id} board={b} all={all} wide={wide} />
          ))}
        </View>
      )}
      {!boards.loading && !boards.error && top.length === 0 && !creating && (
        <EmptyState
          title="Henüz pano yok"
          description="Referanslar, taslaklar ya da hikâye akışı için ilk panoyu aç."
          action={{ label: '+ Yeni pano', onPress: () => setCreating(true) }}
        />
      )}
    </Screen>
  );
}

const pop = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.96 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});

function CreateForm({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const say = useToast();
  const team = useTeam();
  const [name, setName] = useState('');
  const [tint, setTint] = useState<Tint>('a2');
  const [busy, setBusy] = useState(false);
  const can = !!name.trim();

  async function submit() {
    if (!can || busy) return;
    setBusy(true);
    try {
      const id = await createBoard({ title: name.trim(), color: tint, userId: team.meId });
      onClose();
      openBoard(id);
    } catch (e) {
      say(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 22,
          padding: 16,
          gap: 12,
          boxShadow: `0 0 0 1px ${colors.line}, ${colors.shadow}`,
        },
        motion.reduced
          ? null
          : {
              animationName: pop,
              animationDuration: 320,
              animationTimingFunction: EASE_OUT,
              animationFillMode: 'both',
            },
      ]}
    >
      <Txt size={13} weight={700} color="text-2">
        Pano adı
      </Txt>
      <Field
        label="Pano adı"
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
        maxLength={40}
        autoFocus
        placeholder="Örn. Ses tasarımı referansları"
        style={{ borderRadius: 14, fontSize: 16 }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Txt size={13} weight={700} color="text-2">
          Renk
        </Txt>
        {TINT_ORDER.map((t) => (
          <Press
            key={t}
            onPress={() => setTint(t)}
            accessibilityLabel={TINTS[t].label}
            accessibilityState={{ selected: tint === t }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors['line-2'],
              backgroundColor: swatch(colors, t),
              boxShadow: `0 0 0 2px ${colors.surface}, 0 0 0 4px ${tint === t ? colors.text : 'transparent'}`,
            }}
          />
        ))}
        <View style={{ flex: 1 }} />
        <Button label="Vazgeç" kind="soft" bold onPress={onClose} />
        <Button
          label={busy ? 'Açılıyor…' : 'Oluştur ve aç'}
          kind={can ? 'sel' : 'muted'}
          disabled={!can || busy}
          onPress={submit}
        />
      </View>
    </Animated.View>
  );
}

// Liste kartındaki küçük önizleme: panodaki kartları minik dikdörtgenlere indirger (prototipteki miniMap).
const PW = 300;
const PH = 120;

function MiniMap({ board }: { board: BoardWithItems }) {
  const { colors } = useTheme();
  const items = board.items.filter((it) => it.type !== 'heading' || it.data.text);
  if (!items.length) return null;
  const hOf = (it: (typeof items)[number]) => estimateHeight(it);
  const x0 = Math.min(...items.map((i) => i.x));
  const y0 = Math.min(...items.map((i) => i.y));
  const x1 = Math.max(...items.map((i) => i.x + i.w));
  const y1 = Math.max(...items.map((i) => i.y + hOf(i)));
  const pad = 14;
  const k = Math.min((PW - pad * 2) / Math.max(1, x1 - x0), (PH - pad * 2) / Math.max(1, y1 - y0), 0.5);
  const ox = (PW - (x1 - x0) * k) / 2;
  const oy = (PH - (y1 - y0) * k) / 2;
  const pc = (v: number, d: number) => `${Math.round((v / d) * 1000) / 10}%` as const;
  const order = [...items].sort((a, b) => (a.type === 'zone' ? 0 : 1) - (b.type === 'zone' ? 0 : 1));

  return (
    <>
      {order.map((it) => {
        const h = it.type === 'heading' ? 5 / k : hOf(it);
        let bg = colors.surface;
        let op = 0.95;
        let sh = '0 1px 2px rgba(0,0,0,0.12)';
        if (it.type === 'heading') {
          bg = colors.text;
          op = 0.55;
          sh = 'none';
        } else if (it.type === 'zone') {
          bg = it.color === 'surface' ? colors['text-3'] : colors[TINTS[it.color].bg];
          op = 0.35;
          sh = 'none';
        } else if ((it.type === 'note' || it.type === 'board') && it.color !== 'surface') {
          bg = colors[TINTS[it.color].bg];
        } else if (it.type === 'image') {
          bg = colors.a3;
        }
        return (
          <View
            key={it.id}
            style={{
              position: 'absolute',
              left: pc(ox + (it.x - x0) * k, PW),
              top: pc(oy + (it.y - y0) * k, PH),
              width: pc(Math.max(4, it.w * k), PW),
              height: pc(Math.max(3, h * k), PH),
              borderRadius: it.type === 'heading' ? 2 : 4,
              backgroundColor: bg,
              opacity: op,
              boxShadow: sh,
            }}
          />
        );
      })}
    </>
  );
}

function BoardTile({ board, all, wide }: { board: BoardWithItems; all: BoardWithItems[]; wide: boolean }) {
  const { colors } = useTheme();
  const n = board.items.length;
  const subs = all.filter((b) => b.parent_board_id === board.id).length;
  const meta = n ? `${n} öğe${subs ? ` · ${subs} alt pano` : ''}` : 'Henüz boş';
  const t = TINTS[board.color];

  return (
    <Press
      onPress={() => openBoard(board.id)}
      accessibilityLabel={`${board.title} panosunu aç, ${meta}`}
      bg="surface"
      pressScale={0.97}
      style={[
        { borderRadius: 20, overflow: 'hidden', boxShadow: `0 0 0 1px ${colors.line}` },
        wide ? { flexGrow: 1, flexBasis: 240, maxWidth: 360 } : { flexGrow: 1, flexBasis: '45%' },
      ]}
    >
      <View
        aria-hidden
        style={{
          height: wide ? 128 : 92,
          backgroundColor: board.color === 'surface' ? colors.surface2 : colors[t.bg],
          overflow: 'hidden',
        }}
      >
        <MiniMap board={board} />
        {n === 0 && (
          <View
            style={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.7,
            }}
          >
            <Txt size={13} weight={700} color={t.fg}>
              Boş pano
            </Txt>
          </View>
        )}
      </View>
      <View style={{ paddingTop: 11, paddingHorizontal: 14, paddingBottom: 13, gap: 2 }}>
        <Txt size={16} weight={800} numberOfLines={1}>
          {board.title}
        </Txt>
        <Txt size={13} color="muted">
          {meta}
        </Txt>
      </View>
    </Press>
  );
}
