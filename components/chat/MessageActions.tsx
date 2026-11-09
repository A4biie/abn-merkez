import { useState } from 'react';
import { View } from 'react-native';

import { useActions } from '@/components/sheets/ActionsProvider';
import { Button, Pill } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { insertItem, useBoards, uuid } from '@/lib/board';
import { deleteMessage, previewText, toggleMessageHeart, type Message } from '@/lib/chat';
import { friendlyError } from '@/lib/errors';
import { useTeam } from '@/lib/team';
import { useTheme } from '@/theme/ThemeProvider';

type Mode = 'menu' | 'board' | 'confirmDelete';

/**
 * Mesaja uzun basınca açılan panelin içi. Proje odasında "Göreve çevir" ve "Panoya not
 * olarak ekle" o projeyi seçili getirir.
 */
export function MessageActions({
  message,
  projectId,
  onReply,
  onEdit,
  onClose,
}: {
  message: Message;
  projectId: string | null;
  onReply: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const say = useToast();
  const team = useTeam();
  const actions = useActions();
  const [mode, setMode] = useState<Mode>('menu');
  const mine = message.author_id === team.meId;
  const liked = message.message_hearts.some((h) => h.user_id === team.meId);
  const text = previewText(message);

  async function heart() {
    onClose();
    const error = await toggleMessageHeart(message, team.meId, liked);
    if (error) say(friendlyError(error));
  }

  async function remove() {
    const error = await deleteMessage(message);
    onClose();
    say(error ? friendlyError(error) : 'Mesaj silindi');
  }

  function toTask() {
    onClose();
    actions.openAddTask({ title: message.body.slice(0, 140), projectId });
  }

  if (mode === 'board') return <AddToBoard message={message} projectId={projectId} onClose={onClose} />;

  if (mode === 'confirmDelete') {
    return (
      <View style={{ gap: 14 }}>
        <Txt size={20} weight={700}>
          Mesaj silinsin mi?
        </Txt>
        <Txt color="text-3">Odada “Mesaj silindi” yazısı kalır. Bu geri alınamaz.</Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Sil" kind="sel" onPress={remove} style={{ flex: 1 }} />
          <Button label="Vazgeç" kind="soft" onPress={onClose} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 6 }}>
      <Txt size={13.5} color="muted" numberOfLines={2} style={{ marginBottom: 6 }}>
        {team.nameOf(message.author_id)}: {text}
      </Txt>
      <Row
        icon="reply"
        label="Yanıtla"
        onPress={() => {
          onReply();
          onClose();
        }}
      />
      <Row icon="heart" label={liked ? 'Kalbini geri al' : 'Kalp bırak'} onPress={heart} />
      {!!message.body && <Row icon="gorev" label="Göreve çevir" onPress={toTask} />}
      {!!message.body && <Row icon="note" label="Panoya not olarak ekle" onPress={() => setMode('board')} />}
      {mine && !!message.body && (
        <Row
          icon="edit"
          label="Düzenle"
          onPress={() => {
            onEdit();
            onClose();
          }}
        />
      )}
      {(mine || team.isAdmin) && <Row icon="trash" label="Sil" onPress={() => setMode('confirmDelete')} />}
    </View>
  );
}

function Row({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press
      onPress={onPress}
      hoverBg="hover"
      bg="surface2"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 16,
        paddingVertical: 13,
        paddingHorizontal: 14,
      }}
    >
      <Icon name={icon} size={19} color={colors['text-2']} strokeWidth={2} />
      <Txt weight={600}>{label}</Txt>
    </Press>
  );
}

/** Pano seçimi: proje odasında o projenin panosu seçili gelir. */
function AddToBoard({
  message,
  projectId,
  onClose,
}: {
  message: Message;
  projectId: string | null;
  onClose: () => void;
}) {
  const say = useToast();
  const team = useTeam();
  const boards = useBoards();
  const editable = (boards.data ?? []).filter(
    (b) => !b.project_id || team.isAdmin || team.projectMap.get(b.project_id)?.members.includes(team.meId),
  );
  const preferred =
    editable.find((b) => projectId && b.project_id === projectId && !b.parent_board_id) ?? editable[0];
  const [picked, setBoardId] = useState<string | null>(null);
  const boardId = picked ?? preferred?.id ?? null;
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!boardId) return;
    setBusy(true);
    try {
      await insertItem(
        {
          id: uuid(),
          board_id: boardId,
          type: 'note',
          x: 80 + Math.round(Math.random() * 120),
          y: 80 + Math.round(Math.random() * 120),
          w: 260,
          h: null,
          color: 'a2',
          z: Math.floor(Date.now() / 1000) % 1_000_000,
          data: { text: `${message.body}\n— ${team.nameOf(message.author_id)}` },
        },
        team.meId,
      );
      say('Panoya not olarak eklendi');
      onClose();
    } catch (e) {
      say(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <Txt size={20} weight={700}>
        Panoya not olarak ekle
      </Txt>
      {editable.length === 0 ? (
        <Txt color="muted">Ekleyebileceğin bir pano yok. Önce Panolar&apos;dan bir pano aç.</Txt>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {editable.map((b) => (
            <Pill
              key={b.id}
              label={b.title}
              onSheet
              active={boardId === b.id}
              onPress={() => setBoardId(b.id)}
            />
          ))}
        </View>
      )}
      <Button label={busy ? 'Ekleniyor…' : 'Notu ekle'} size="lg" onPress={add} disabled={busy || !boardId} />
    </View>
  );
}
