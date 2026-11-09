import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';

import { useIsWide } from '@/components/layout/useIsWide';
import { Box } from '@/components/ui/Box';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import {
  markRead,
  toggleMessageHeart,
  useMessages,
  useRoomMembers,
  useRooms,
  type Message,
} from '@/lib/chat';
import { friendlyError } from '@/lib/errors';
import { useTeam } from '@/lib/team';
import { dayLabel } from '@/lib/time';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { Composer } from './Composer';
import { MessageActions } from './MessageActions';
import { MessageBubble } from './MessageBubble';
import { roomSubtitle, roomTitle, RoomIcon } from './rooms';

/** Arka arkaya gelen mesajlar bu süre içindeyse aynı balon grubunda gösterilir. */
const GROUP_MS = 5 * 60 * 1000;

export function ChatRoom({ roomId }: { roomId: string }) {
  const { colors } = useTheme();
  const wide = useIsWide();
  const motion = useMotion();
  const insets = useSafeAreaInsets();
  const say = useToast();
  const team = useTeam();
  const rooms = useRooms();
  const messages = useMessages(roomId);
  const members = useRoomMembers(roomId);
  const list = useRef<FlashListRef<Message>>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [menuFor, setMenuFor] = useState<Message | null>(null);

  const room = rooms.data?.find((r) => r.room_id === roomId);
  // Odalar yüklendi ama bu oda yok: silinmiş, üyeliğin kalkmış ya da adres yanlış.
  const missing = !!rooms.data && !room;
  const data = messages.data ?? [];
  const byId = new Map(data.map((m) => [m.id, m]));

  // Oda açıkken gelen mesajlar da okunmuş sayılır (okunmamış noktası çıkmasın).
  const lastId = data[data.length - 1]?.id;
  useEffect(() => {
    if (team.meId && roomId) markRead(roomId, team.meId);
  }, [roomId, team.meId, lastId]);

  async function heart(m: Message) {
    const liked = m.message_hearts.some((h) => h.user_id === team.meId);
    const error = await toggleMessageHeart(m, team.meId, liked);
    if (error) say(friendlyError(error));
  }

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/sohbet'));

  return (
    <Animated.View style={[{ flex: 1 }, Platform.OS === 'web' ? motion.page() : null]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <Box
          border="line"
          style={{
            borderWidth: 0,
            borderBottomWidth: 1,
            paddingTop: (wide ? 18 : 12) + (wide ? 0 : insets.top),
            paddingBottom: 12,
            paddingHorizontal: wide ? 32 : 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Press
            onPress={back}
            accessibilityLabel="Sohbetlere dön"
            bg="surface"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="back" size={20} color={colors.text} strokeWidth={2} />
          </Press>
          {room && <RoomIcon room={room} size={40} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={wide ? 20 : 18} weight={700} numberOfLines={1}>
              {room ? roomTitle(room, team) : 'Sohbet'}
            </Txt>
            {room && (
              <Txt size={12.5} color="muted" numberOfLines={1}>
                {roomSubtitle(room, members.data?.length)}
              </Txt>
            )}
          </View>
        </Box>

        {missing ? (
          <View style={{ padding: 20, gap: 16 }}>
            <EmptyState
              title="Bu sohbet bulunamadı"
              description="Silinmiş ya da artık üyesi olmadığın bir oda olabilir."
              action={{ label: 'Sohbetlere dön', onPress: () => router.navigate('/sohbet') }}
            />
          </View>
        ) : messages.loading ? (
          <View style={{ padding: 20 }}>
            <SkeletonCards count={3} lines={1} />
          </View>
        ) : messages.error ? (
          <View style={{ padding: 20 }}>
            <ErrorState message={messages.error} onRetry={messages.refetch} />
          </View>
        ) : (
          // FlashList: uzun sohbetlerde sadece ekrandaki mesajlar çizilir. En alttan başlar; alttayken
          // yeni mesaj gelince kendiliğinden kayar, yukarıda okurken yerinden oynatmaz.
          <FlashList
            ref={list}
            data={data}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{
              paddingHorizontal: wide ? 32 : 20,
              paddingVertical: 14,
            }}
            maintainVisibleContentPosition={{
              startRenderingFromBottom: true,
              autoscrollToBottomThreshold: 0.2,
            }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <EmptyState
                title="Burası sessiz"
                description="İlk mesajı sen yaz. Birini anmak için @ ile adını yazman yeterli."
              />
            }
            renderItem={({ item, index }) => {
              const prev = data[index - 1];
              const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(item.created_at);
              const grouped =
                !newDay &&
                !!prev &&
                prev.author_id === item.author_id &&
                new Date(item.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_MS;
              return (
                <View>
                  {newDay && (
                    <Txt
                      size={12}
                      weight={600}
                      color="faint"
                      style={{ textAlign: 'center', marginVertical: 12 }}
                    >
                      {dayLabel(item.created_at)}
                    </Txt>
                  )}
                  <MessageBubble
                    message={item}
                    replied={item.reply_to ? byId.get(item.reply_to) : undefined}
                    grouped={grouped}
                    showAuthor={room?.kind !== 'ozel'}
                    onLongPress={() => setMenuFor(item)}
                    onToggleHeart={() => heart(item)}
                  />
                </View>
              );
            }}
          />
        )}

        {!missing && (
          <View style={{ paddingHorizontal: wide ? 32 : 20, paddingTop: 8, paddingBottom: 12 }}>
            <Composer
              key={editing?.id ?? 'yeni'}
              roomId={roomId}
              memberIds={members.data ?? []}
              replyTo={replyTo}
              editing={editing}
              onDone={() => {
                setReplyTo(null);
                setEditing(null);
                // Kendi mesajını gönderen en alta iner (yukarıda okurken bile).
                if (!editing) setTimeout(() => list.current?.scrollToEnd({ animated: true }), 80);
              }}
            />
          </View>
        )}

        <Sheet open={!!menuFor} onClose={() => setMenuFor(null)} label="Mesaj işlemleri">
          {menuFor && (
            <MessageActions
              message={menuFor}
              projectId={room?.project_id ?? null}
              onReply={() => {
                setEditing(null);
                setReplyTo(menuFor);
              }}
              onEdit={() => {
                setReplyTo(null);
                setEditing(menuFor);
              }}
              onClose={() => setMenuFor(null)}
            />
          )}
        </Sheet>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
