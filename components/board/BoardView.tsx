import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Platform, View } from 'react-native';
import Animated, { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useIsWide } from '@/components/layout/useIsWide';
import { UploadList } from '@/components/UploadCard';
import { Box } from '@/components/ui/Box';
import { Button } from '@/components/ui/Controls';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import {
  createBoard,
  deleteItem,
  deleteLink,
  fetchBoardItems,
  fetchBoardLinks,
  insertItem,
  insertLink,
  renameBoard,
  subscribeBoard,
  updateItem,
  updateLink,
  useBoards,
  uuid,
  type BoardItem,
  type BoardLink,
  type BoardWithItems,
  type Cap,
  type ItemData,
  type ItemType,
  type Tint,
} from '@/lib/board';
import { friendlyError } from '@/lib/errors';
import { clearFinished, startUpload, useUploads } from '@/lib/uploads';
import { useTeam } from '@/lib/team';
import { invalidate } from '@/lib/useQuery';
import { css, EASE_OUT, useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import type { Camera } from './camera';
import { Canvas, useCamera, type CanvasApi } from './Canvas';
import { HelpButton, HelpPanel, LinkMenu, MorePanel, Toolbar, type Tool } from './Toolbar';
import { swatch, TINT_ORDER, TINTS } from './tints';

const viewIn = css.keyframes({
  from: { opacity: 0, transform: [{ scale: 0.985 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
});

// Yeni kartların başlangıç hali (Board.dc.html add()).
const NEW_ITEM: Record<ItemType, { w: number; h?: number; color?: Tint; data: ItemData }> = {
  note: { w: 240, data: { text: '' } },
  todo: { w: 260, data: { text: 'Yapılacaklar', todos: [] } },
  image: { w: 260, data: { text: '' } },
  color: { w: 270, data: { text: 'Yeni palet', swatches: ['#2E2F73', '#6366B0', '#A094C8', '#EBCFE5'] } },
  link: { w: 240, data: { text: 'Yeni link', url: '' } },
  heading: { w: 320, data: { text: 'Başlık' } },
  board: { w: 230, color: 'a1', data: { text: 'Yeni pano' } },
  zone: { w: 460, h: 320, color: 'a2', data: { text: 'Yeni bölge' } },
  sketch: { w: 280, data: { strokes: [] } },
  table: {
    w: 320,
    data: {
      rows: [
        ['Başlık', 'Başlık', 'Başlık'],
        ['', '', ''],
        ['', '', ''],
      ],
    },
  },
  quote: { w: 280, data: { text: 'Buraya bir alıntı yaz.', author: '' } },
  file: { w: 260, data: { text: 'Dosya' } },
  video: { w: 280, data: { text: 'Video', url: '' } },
};

/** Bir panonun içi: üst çubuk, sonsuz tuval, araç çubuğu (Board.dc.html "Pano tuvali"). */
export function BoardView({ boardId }: { boardId: string }) {
  const boards = useBoards();
  const board = boards.data?.find((b) => b.id === boardId);

  if (boards.loading) {
    return (
      <View style={{ flex: 1, padding: 20 }}>
        <SkeletonCards count={2} />
      </View>
    );
  }
  if (!board) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 16 }}>
        <ErrorState
          message={boards.error ?? 'Bu pano bulunamadı. Silinmiş olabilir.'}
          onRetry={boards.error ? boards.refetch : undefined}
        />
        <Button
          label="Panolara dön"
          kind="soft"
          onPress={() => router.navigate('/panolar')}
          style={{ alignSelf: 'flex-start' }}
        />
      </View>
    );
  }
  return <BoardEditor key={board.id} board={board} all={boards.data ?? []} />;
}

function BoardEditor({ board, all }: { board: BoardWithItems; all: BoardWithItems[] }) {
  const wide = useIsWide();
  const compact = !wide;
  const motion = useMotion();
  const say = useToast();
  const team = useTeam();
  const cam = useCamera(compact);
  const api = useRef<CanvasApi | null>(null);

  const [items, setItems] = useState<BoardItem[] | null>(null);
  const [links, setLinks] = useState<BoardLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  // "Tekrar dene" yüklemeyi baştan başlatır.
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canEdit = !board.project_id || team.isAdmin || team.isMember(board.project_id);
  const projectName = board.project_id ? team.projectMap.get(board.project_id)?.name : undefined;

  // ── Yükleme ve canlı güncelleme ──
  const editingRef = useRef(editing);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);
  useEffect(() => {
    let alive = true;
    Promise.all([fetchBoardItems(board.id), fetchBoardLinks(board.id)])
      .then(([its, lks]) => {
        if (!alive) return;
        setItems(its);
        setLinks(lks);
      })
      .then(() => alive && setError(null))
      .catch((e) => alive && setError(friendlyError(e)));
    const channel = subscribeBoard(board.id, (c) => {
      if (c.table === 'items') {
        setItems((prev) => {
          if (!prev) return prev;
          if (c.type === 'delete') return prev.filter((it) => it.id !== c.id);
          // Yazılmakta olan kartın metni başkasının kaydıyla ezilmesin.
          if (c.row.id === editingRef.current) return prev;
          return prev.some((it) => it.id === c.row.id)
            ? prev.map((it) => (it.id === c.row.id ? { ...it, ...c.row } : it))
            : [...prev, c.row];
        });
      } else {
        setLinks((prev) => {
          if (c.type === 'delete') return prev.filter((l) => l.id !== c.id);
          return prev.some((l) => l.id === c.row.id)
            ? prev.map((l) => (l.id === c.row.id ? c.row : l))
            : [...prev, c.row];
        });
      }
    });
    return () => {
      alive = false;
      channel.unsubscribe();
    };
  }, [board.id, attempt]);

  // ── Kaydetme ──
  const fail = useCallback((e: unknown) => say(friendlyError(e)), [say]);
  const uploads = useUploads(board.id);
  const uploadsDone = uploads.length > 0 && uploads.every((j) => j.status === 'done');
  // Hepsi bitince özet kapsülü bir süre görünür, sonra kartlar kaybolur.
  useEffect(() => {
    if (!uploadsDone) return;
    const id = setTimeout(() => clearFinished(board.id), 4500);
    return () => clearTimeout(id);
  }, [uploadsDone, board.id]);
  const patchItem = useCallback((id: string, patch: Partial<BoardItem>) => {
    setItems((prev) => prev?.map((it) => (it.id === id ? { ...it, ...patch } : it)) ?? prev);
  }, []);
  const patchLink = useCallback(
    (id: string, patch: Partial<BoardLink>) => {
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      updateLink(id, patch).catch(fail);
    },
    [fail],
  );

  // Metin her tuşta kaydedilmez; yazma durunca yarım saniye sonra kaydedilir.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const onData = useCallback(
    (id: string, patch: ItemData) => {
      const it = itemsRef.current?.find((x) => x.id === id);
      if (!it) return;
      const data = { ...it.data, ...patch };
      patchItem(id, { data });
      clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => {
        updateItem(id, { data }).catch(fail);
        // Alt pano kartının adı panonun adıdır.
        if (it.type === 'board' && data.board_id && patch.text !== undefined)
          renameBoard(data.board_id, data.text ?? '').catch(fail);
        invalidate('boards');
      }, 500);
    },
    [patchItem, fail],
  );
  const onWidth = useCallback(
    (id: string, w: number) => {
      patchItem(id, { w });
      updateItem(id, { w }).catch(fail);
    },
    [patchItem, fail],
  );

  // ── Seçim ──
  const clearSelection = useCallback(() => {
    setSelected(null);
    setSelectedLink(null);
    setEditing(null);
    setConfirmDelete(false);
  }, []);

  const createLink = useCallback(
    async (from: string, to: string) => {
      const link: BoardLink = {
        id: uuid(),
        board_id: board.id,
        from_item: from,
        to_item: to,
        start_cap: 'none',
        end_cap: 'arrow',
        dashed: false,
        bend_x: 0,
        bend_y: 0,
      };
      setLinks((prev) => [...prev, link]);
      setSelected(null);
      setSelectedLink(link.id);
      try {
        await insertLink(link, team.meId);
      } catch (e) {
        setLinks((prev) => prev.filter((l) => l.id !== link.id));
        fail(e);
      }
    },
    [board.id, team.meId, fail],
  );

  const onTapCard = useCallback(
    (id: string, wasSelected: boolean, soft: boolean) => {
      setMoreOpen(false);
      setHelpOpen(false);
      setConfirmDelete(false);
      if (connecting) {
        // "Bağla" aracı: önce ilk karta, sonra ikinciye dokunulur.
        if (!linkFrom) {
          setLinkFrom(id);
          return;
        }
        if (linkFrom !== id) createLink(linkFrom, id);
        setConnecting(false);
        setLinkFrom(null);
        return;
      }
      setSelectedLink(null);
      setSelected(id);
      if (wasSelected && !soft && canEdit) setEditing(id);
      else if (editing !== id) setEditing(null);
    },
    [connecting, linkFrom, createLink, canEdit, editing],
  );

  const onTapLink = useCallback((id: string) => {
    setSelected(null);
    setEditing(null);
    setMoreOpen(false);
    setSelectedLink(id);
  }, []);

  const onTapEmpty = useCallback(() => {
    clearSelection();
    setMoreOpen(false);
    setHelpOpen(false);
  }, [clearSelection]);

  const onDragStart = useCallback((id: string) => {
    setSelected(id);
    setSelectedLink(null);
    setEditing(null);
  }, []);

  const onMove = useCallback(
    (id: string, x: number, y: number) => {
      const prev = itemsRef.current?.find((it) => it.id === id);
      patchItem(id, { x, y });
      updateItem(id, { x, y }).catch((e) => {
        if (prev) patchItem(id, { x: prev.x, y: prev.y });
        fail(e);
      });
    },
    [patchItem, fail],
  );

  const onResize = useCallback(
    (id: string, w: number, h: number) => {
      patchItem(id, { w, h });
      updateItem(id, { w, h }).catch(fail);
    },
    [patchItem, fail],
  );

  const onLinkDrop = useCallback(
    (from: string, to: string | null, reconnect: { id: string; which: 'from' | 'to' } | null) => {
      if (reconnect) {
        if (to) patchLink(reconnect.id, reconnect.which === 'from' ? { from_item: to } : { to_item: to });
        setSelectedLink(reconnect.id);
        return;
      }
      if (to) createLink(from, to);
    },
    [patchLink, createLink],
  );

  const onBend = useCallback(
    (id: string, x: number, y: number) => patchLink(id, { bend_x: x, bend_y: y }),
    [patchLink],
  );

  const openBoard = useCallback(
    (id: string) => router.navigate({ pathname: '/panolar', params: { pano: id } }),
    [],
  );

  // ── Ekleme ──
  async function add(type: ItemType, extra?: Partial<ItemData>) {
    if (!items || !api.current) return;
    setMoreOpen(false);
    setConnecting(false);
    setLinkFrom(null);
    const base = NEW_ITEM[type];
    const at = api.current.spot(base.w, items.length);
    const item: BoardItem = {
      id: uuid(),
      board_id: board.id,
      type,
      x: at.x,
      y: at.y,
      w: base.w,
      h: base.h ?? null,
      color: base.color ?? 'surface',
      z: type === 'zone' ? -1 : items.length,
      data: { ...(JSON.parse(JSON.stringify(base.data)) as ItemData), ...extra },
    };
    try {
      if (type === 'board') {
        item.data.board_id = await createBoard({
          title: item.data.text ?? 'Yeni pano',
          color: 'a1',
          userId: team.meId,
          parentId: board.id,
        });
      }
    } catch (e) {
      fail(e);
      return;
    }
    setItems((prev) => (prev ? (type === 'zone' ? [item, ...prev] : [...prev, item]) : prev));
    setSelectedLink(null);
    setSelected(item.id);
    setEditing(type === 'note' && !extra ? item.id : null);
    try {
      await insertItem(item, team.meId);
      invalidate('boards');
    } catch (e) {
      setItems((prev) => prev?.filter((it) => it.id !== item.id) ?? prev);
      fail(e);
    }
  }

  // ── Dosya yükleme: birden çok dosya, her biri bitince pano kartı olur ──
  async function uploadFiles() {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (res.canceled) return;
    clearFinished(board.id);
    for (const a of res.assets) {
      if ((a.size ?? 0) > 50 * 1024 * 1024) {
        say(`${a.name} 50 MB’tan büyük, yüklenmedi.`);
        continue;
      }
      try {
        const body: Blob = Platform.OS === 'web' && a.file ? a.file : await (await fetch(a.uri)).blob();
        const mime = a.mimeType || body.type || 'application/octet-stream';
        const dot = a.name.lastIndexOf('.');
        const ext =
          dot > 0
            ? a.name
                .slice(dot + 1)
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '') || 'bin'
            : 'bin';
        const preview = mime.startsWith('image/')
          ? a.uri
          : mime.startsWith('video/')
            ? await videoThumb(a.uri)
            : null;
        startUpload({
          group: board.id,
          bucket: 'board-files',
          path: `${board.id}/${uuid()}.${ext}`,
          body,
          name: a.name,
          mime,
          preview,
          onDone: (path) =>
            mime.startsWith('image/')
              ? add('image', { path, text: a.name.replace(/.[^.]+$/, '') })
              : add('file', { path, text: a.name, size: a.size ?? body.size, mime }),
        });
      } catch (e) {
        fail(e);
      }
    }
  }

  function onTool(t: Tool) {
    if (t === 'upload') {
      uploadFiles();
      return;
    }
    if (t === 'connect') {
      const next = !connecting;
      setConnecting(next);
      setLinkFrom(null);
      setMoreOpen(false);
      clearSelection();
      return;
    }
    add(t);
  }

  // ── Üst çubuk işleri ──
  async function setTint(t: Tint) {
    if (!selected) return;
    patchItem(selected, { color: t });
    updateItem(selected, { color: t }).catch(fail);
  }

  async function removeSelected() {
    if (!selected) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const id = selected;
    const beforeItems = items;
    const beforeLinks = links;
    setItems((prev) => prev?.filter((it) => it.id !== id) ?? prev);
    setLinks((prev) => prev.filter((l) => l.from_item !== id && l.to_item !== id));
    clearSelection();
    try {
      await deleteItem(id);
      invalidate('boards');
    } catch (e) {
      setItems(beforeItems);
      setLinks(beforeLinks);
      fail(e);
    }
  }

  const selLink = links.find((l) => l.id === selectedLink);
  async function removeLink() {
    if (!selLink) return;
    const before = links;
    setLinks((prev) => prev.filter((l) => l.id !== selLink.id));
    setSelectedLink(null);
    deleteLink(selLink.id).catch((e) => {
      setLinks(before);
      fail(e);
    });
  }

  const sel = items?.find((it) => it.id === selected);
  const tintable = sel && (sel.type === 'note' || sel.type === 'board' || sel.type === 'zone');

  return (
    <Animated.View
      style={[
        { flex: 1 },
        motion.reduced
          ? null
          : {
              animationName: viewIn,
              animationDuration: 280,
              animationTimingFunction: EASE_OUT,
              animationFillMode: 'both',
            },
      ]}
    >
      <TopBar
        board={board}
        all={all}
        compact={compact}
        cam={cam}
        api={api}
        tint={canEdit && tintable ? sel.color : null}
        onTint={setTint}
        canDelete={canEdit && !!sel}
        confirmDelete={confirmDelete}
        onDelete={removeSelected}
      />
      {!canEdit && (
        <Box bg="a2" style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
          <Txt size={13.5} weight={600} color="a2-ink">
            Bu pano {projectName ?? 'bir proje'} ekibine ait. Bakabilirsin ama değiştiremezsin.
          </Txt>
        </Box>
      )}
      {connecting && (
        <Box
          bg="a2"
          style={{
            paddingVertical: 8,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Txt size={13.5} weight={600} color="a2-ink" style={{ flex: 1 }}>
            {linkFrom
              ? 'Şimdi bağlanacak ikinci karta dokun.'
              : 'Bağlamak için önce ilk karta dokun. İpucu: seçili kartın yanındaki noktayı da sürükleyebilirsin.'}
          </Txt>
          <Press
            onPress={() => {
              setConnecting(false);
              setLinkFrom(null);
            }}
            style={{
              borderRadius: 999,
              paddingVertical: 4,
              paddingHorizontal: 10,
              backgroundColor: 'rgba(0,0,0,0.14)',
            }}
          >
            <Txt size={12.5} weight={700} color="a2-ink">
              Vazgeç
            </Txt>
          </Press>
        </Box>
      )}
      <View style={{ flex: 1, minHeight: 0 }}>
        {error ? (
          <View style={{ padding: 20 }}>
            <ErrorState message={error} onRetry={() => setAttempt((n) => n + 1)} />
          </View>
        ) : !items ? (
          <View style={{ padding: 20 }}>
            <SkeletonCards count={1} />
          </View>
        ) : (
          <Canvas
            items={items}
            links={links}
            boards={all}
            boardId={board.id}
            selected={selected}
            selectedLink={selectedLink}
            editing={editing}
            linkFrom={linkFrom}
            readOnly={!canEdit}
            cam={cam}
            onTapCard={onTapCard}
            onTapLink={onTapLink}
            onTapEmpty={onTapEmpty}
            onDragStart={onDragStart}
            onMove={onMove}
            onResize={onResize}
            onLinkDrop={onLinkDrop}
            onBend={onBend}
            onData={onData}
            onWidth={onWidth}
            openBoard={openBoard}
            onReady={(a) => {
              api.current = a;
            }}
          />
        )}
        <HelpButton open={helpOpen} onToggle={() => setHelpOpen((o) => !o)} />
        {helpOpen && <HelpPanel compact={compact} onClose={() => setHelpOpen(false)} />}
        {canEdit && items && (
          <>
            <Toolbar
              compact={compact}
              connecting={connecting}
              moreOpen={moreOpen}
              onTool={onTool}
              onToggleMore={() => setMoreOpen((o) => !o)}
            />
            {moreOpen && (
              <MorePanel compact={compact} onPick={(t) => add(t)} onClose={() => setMoreOpen(false)} />
            )}
            {uploads.length > 0 && (
              <View
                pointerEvents="box-none"
                style={{
                  position: 'absolute',
                  right: 12,
                  bottom: compact ? 100 : 12,
                  width: 340,
                  maxWidth: '92%',
                  zIndex: 22,
                }}
              >
                <UploadList jobs={uploads} target={`${board.title} panosuna`} />
              </View>
            )}
            {selLink && !moreOpen && (
              <LinkMenu
                compact={compact}
                start={selLink.start_cap}
                end={selLink.end_cap}
                dashed={selLink.dashed}
                bent={!!(selLink.bend_x || selLink.bend_y)}
                onCap={(side, c: Cap) =>
                  patchLink(selLink.id, side === 's' ? { start_cap: c } : { end_cap: c })
                }
                onStraighten={() => patchLink(selLink.id, { bend_x: 0, bend_y: 0 })}
                onDash={() => patchLink(selLink.id, { dashed: !selLink.dashed })}
                onFlip={() =>
                  patchLink(selLink.id, {
                    from_item: selLink.to_item,
                    to_item: selLink.from_item,
                    start_cap: selLink.end_cap,
                    end_cap: selLink.start_cap,
                  })
                }
                onDelete={removeLink}
              />
            )}
          </>
        )}
      </View>
    </Animated.View>
  );
}

function TopBar({
  board,
  all,
  compact,
  cam,
  api,
  tint,
  onTint,
  canDelete,
  confirmDelete,
  onDelete,
}: {
  board: BoardWithItems;
  all: BoardWithItems[];
  compact: boolean;
  cam: Camera;
  api: React.RefObject<CanvasApi | null>;
  tint: Tint | null;
  onTint: (t: Tint) => void;
  canDelete: boolean;
  confirmDelete: boolean;
  onDelete: () => void;
}) {
  const { colors } = useTheme();

  // Panolar › PaleMouth › Mekânlar
  const path: BoardWithItems[] = [];
  let cur: BoardWithItems | undefined = board;
  for (let guard = 0; cur && guard < 10; guard++) {
    path.unshift(cur);
    const parent: string | null = cur.parent_board_id;
    cur = parent ? all.find((b) => b.id === parent) : undefined;
  }
  const crumbs = [
    { id: null as string | null, label: 'Panolar' },
    ...path.map((b) => ({ id: b.id, label: b.title })),
  ];

  const toolBtn = (label: string, onPress: () => void, child: React.ReactNode) => (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      hoverBg="hover"
      pressScale={0.92}
      style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}
    >
      {child}
    </Press>
  );

  return (
    <Box
      bg="nav"
      border="line"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        paddingVertical: compact ? 8 : 10,
        paddingHorizontal: compact ? 10 : 16,
        borderWidth: 0,
        borderBottomWidth: 1,
      }}
    >
      <View
        role="navigation"
        aria-label="Pano yolu"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <View
              key={c.id ?? 'root'}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                flexShrink: last ? 1 : 0,
                minWidth: 0,
              }}
            >
              <Press
                onPress={() =>
                  c.id
                    ? router.navigate({ pathname: '/panolar', params: { pano: c.id } })
                    : router.navigate('/panolar')
                }
                hoverBg="hover"
                style={{
                  borderRadius: 10,
                  paddingVertical: 5,
                  paddingHorizontal: 8,
                  flexShrink: 1,
                  minWidth: 0,
                }}
              >
                <Txt
                  size={last ? 15 : 14}
                  weight={last ? 800 : 600}
                  color={last ? 'text' : 'muted'}
                  numberOfLines={1}
                >
                  {c.label}
                </Txt>
              </Press>
              {!last && (
                <Txt size={14} color="faint" aria-hidden>
                  ›
                </Txt>
              )}
            </View>
          );
        })}
      </View>

      {tint && (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }} aria-label="Kart rengi">
          {TINT_ORDER.map((t) => (
            <Press
              key={t}
              onPress={() => onTint(t)}
              accessibilityLabel={TINTS[t].label}
              accessibilityState={{ selected: tint === t }}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors['line-2'],
                backgroundColor: swatch(colors, t),
                boxShadow: `0 0 0 2px ${colors.nav}, 0 0 0 4px ${tint === t ? colors.text : 'transparent'}`,
              }}
            />
          ))}
        </View>
      )}

      {canDelete && (
        <Button
          label={confirmDelete ? 'Emin misin? Sil' : 'Sil'}
          kind="soft"
          size="sm"
          icon="trash"
          onPress={onDelete}
          style={confirmDelete ? { backgroundColor: '#E06C6C' } : undefined}
        />
      )}

      <Box
        bg="surface"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 999, padding: 3 }}
      >
        {toolBtn(
          'Uzaklaştır',
          () => api.current?.zoomBy(1 / 1.2),
          <Txt size={18} weight={600} leading={1}>
            −
          </Txt>,
        )}
        <ZoomLabel cam={cam} />
        {toolBtn(
          'Yakınlaştır',
          () => api.current?.zoomBy(1.2),
          <Txt size={18} weight={600} leading={1}>
            +
          </Txt>,
        )}
        {toolBtn(
          'Tüm kartları sığdır',
          () => api.current?.fit(),
          <Icon name="fit" size={16} color={colors.text} strokeWidth={2.2} />,
        )}
      </Box>
    </Box>
  );
}

/** Yakınlaştırma yüzdesi. Kamera her karede değişir ama sadece yüzde değişince yeniden çizilir. */
function ZoomLabel({ cam }: { cam: Camera }) {
  // İlk değer de tepkiden gelir; render sırasında paylaşılan değer okunmaz.
  const [pct, setPct] = useState(100);
  useAnimatedReaction(
    () => Math.round(cam.zoom.get() * 100),
    (now, prev) => {
      if (now !== prev) scheduleOnRN(setPct, now);
    },
  );
  return (
    <Txt size={13} weight={700} style={{ minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
      {pct}%
    </Txt>
  );
}

/** Webde videonun ilk karesinden küçük resim; telefonda null (önizleme yerine uzantı kartı). */
async function videoThumb(uri: string): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    video.src = uri;
    const done = (v: string | null) => {
      video.removeAttribute('src');
      resolve(v);
    };
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.1, video.duration || 0);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 124;
        canvas.height = Math.round((124 * video.videoHeight) / Math.max(1, video.videoWidth)) || 124;
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        done(null);
      }
    };
    video.onerror = () => done(null);
    setTimeout(() => done(null), 4000);
  });
}
