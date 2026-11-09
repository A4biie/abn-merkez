import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { roomTitle, RoomIcon } from '@/components/chat/rooms';
import { Screen } from '@/components/layout/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Button, Card } from '@/components/ui/Controls';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { Press } from '@/components/ui/Press';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { openDirectRoom, previewText, useRooms, type RoomOverview } from '@/lib/chat';
import { friendlyError } from '@/lib/errors';
import { useTeam } from '@/lib/team';
import { timeAgo } from '@/lib/time';
import { useTheme } from '@/theme/ThemeProvider';

/** Oda listesi: genel, projeler ve özel mesajlar. Son mesaj ve okunmamış noktası. */
export default function Sohbet() {
  const rooms = useRooms();
  const [picking, setPicking] = useState(false);
  const newMessage = <Button label="Yeni mesaj" icon="plus" kind="accent" onPress={() => setPicking(true)} />;

  return (
    <Screen
      onRefresh={rooms.refetch}
      title="Sohbet"
      crumb="Genel, projeler ve özel mesajlar"
      wideAction={newMessage}
      action={newMessage}
    >
      {rooms.loading ? (
        <SkeletonCards count={3} lines={1} />
      ) : rooms.error ? (
        <ErrorState message={rooms.error} onRetry={rooms.refetch} />
      ) : (
        <Card radius={24} padding={6} gap={0} style={{ maxWidth: 760 }}>
          {(rooms.data ?? []).map((r) => (
            <RoomRow key={r.room_id} room={r} />
          ))}
        </Card>
      )}
      <Txt size={13} color="muted" style={{ maxWidth: 760 }}>
        Kimin ne zaman okuduğu ya da yazdığı görünmez; acele yok, müsait olunca cevap verilir.
      </Txt>
      <Sheet open={picking} onClose={() => setPicking(false)} label="Yeni mesaj">
        <PersonPicker onClose={() => setPicking(false)} />
      </Sheet>
    </Screen>
  );
}

function RoomRow({ room }: { room: RoomOverview }) {
  const { colors } = useTheme();
  const team = useTeam();
  const preview = room.last_message_at
    ? `${room.last_author === team.meId ? 'Sen' : team.nameOf(room.last_author)}: ${previewText({
        body: room.last_body,
        attachment_kind: room.last_attachment,
        deleted_at: room.last_deleted ? 'x' : null,
      })}`
    : 'Henüz mesaj yok';

  return (
    <Press
      onPress={() => router.navigate({ pathname: '/sohbet/[id]', params: { id: room.room_id } })}
      hoverBg="hover"
      pressScale={0.98}
      accessibilityLabel={`${roomTitle(room, team)}${room.unread ? ', okunmamış mesaj var' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18 }}
    >
      <RoomIcon room={room} size={46} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt weight={700} numberOfLines={1} style={{ flex: 1 }}>
            {roomTitle(room, team)}
          </Txt>
          {room.last_message_at && (
            <Txt size={12} color="faint">
              {timeAgo(room.last_message_at)}
            </Txt>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt
            size={13.5}
            color={room.unread ? 'text' : 'muted'}
            weight={room.unread ? 600 : 400}
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {preview}
          </Txt>
          {room.unread && (
            <View
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors['accent-text'] }}
            />
          )}
        </View>
      </View>
    </Press>
  );
}

function PersonPicker({ onClose }: { onClose: () => void }) {
  const say = useToast();
  const team = useTeam();
  const people = [...team.people.values()].filter((p) => p.id !== team.meId);

  async function open(id: string) {
    try {
      const roomId = await openDirectRoom(id);
      onClose();
      router.navigate({ pathname: '/sohbet/[id]', params: { id: roomId } });
    } catch (e) {
      say(friendlyError(e));
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <Txt size={20} weight={700}>
        Kime yazmak istersin?
      </Txt>
      {people.length === 0 && <Txt color="muted">Ekipte henüz başka kimse yok.</Txt>}
      {people.map((p) => (
        <Press
          key={p.id}
          onPress={() => open(p.id)}
          hoverBg="hover"
          bg="surface2"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 10 }}
        >
          <Avatar person={p} size={36} />
          <View style={{ flex: 1 }}>
            <Txt weight={600}>{p.full_name}</Txt>
            <Txt size={12.5} color="muted">
              {p.role_title || `@${p.username}`}
            </Txt>
          </View>
        </Press>
      ))}
    </View>
  );
}
