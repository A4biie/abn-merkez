// Sohbet veri katmanı (supabase/migrations/20261102000600_chat.sql).
// Odalar ve üyelikler veritabanında tetikleyicilerle yönetilir; istemci sadece mesaj yazar,
// kendi okuma zamanını günceller ve özel oda açar.

import { uuid } from './board';
import { enqueue, isOffline } from './connection';
import { supabase } from './supabase';
import { invalidate, mutateCache, useQuery } from './useQuery';

export type RoomKind = 'genel' | 'proje' | 'ozel';

export type RoomOverview = {
  room_id: string;
  kind: RoomKind;
  project_id: string | null;
  title: string;
  other_user: string | null;
  last_message_at: string | null;
  last_body: string | null;
  last_author: string | null;
  last_attachment: 'gorsel' | 'ses' | null;
  last_deleted: boolean | null;
  unread: boolean;
};

export type Message = {
  id: string;
  room_id: string;
  author_id: string | null;
  body: string;
  attachment_path: string | null;
  attachment_kind: 'gorsel' | 'ses' | null;
  attachment_ms: number | null;
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  message_hearts: { user_id: string }[];
  /** Bağlantı yokken yazıldı, gönderilmeyi bekliyor. */
  pending?: boolean;
  /** Kuyruktan az önce gönderildi (kısa bir süre tik görünür). */
  sentFromQueue?: boolean;
};

/** Odada en fazla bu kadar son mesaj yüklenir. */
const PAGE = 200;

function must<T>(res: { data: unknown; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export async function fetchRooms() {
  return must<RoomOverview[]>(await supabase.rpc('chat_overview'));
}
export const useRooms = () => useQuery('chatRooms', fetchRooms);

/** Menüdeki Sohbet sekmesinde nokta: okunmamış mesajı olan bir oda var mı. */
export function useChatUnread() {
  return !!useRooms().data?.some((r) => r.unread);
}

export async function fetchMessages(roomId: string) {
  const rows = must<Message[]>(
    await supabase
      .from('messages')
      .select('*, message_hearts(user_id)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(PAGE),
  );
  return rows.reverse();
}
export const useMessages = (roomId: string | undefined) =>
  useQuery(roomId ? `messages:${roomId}` : null, () => fetchMessages(roomId!));

export async function sendMessage(input: {
  roomId: string;
  userId: string;
  body: string;
  replyTo?: string | null;
  attachment?: { path: string; kind: 'gorsel' | 'ses'; ms?: number | null };
}) {
  const row = {
    id: uuid(),
    room_id: input.roomId,
    author_id: input.userId,
    body: input.body,
    reply_to: input.replyTo ?? null,
    attachment_path: input.attachment?.path ?? null,
    attachment_kind: input.attachment?.kind ?? null,
    attachment_ms: input.attachment?.ms ?? null,
  };
  // Mesaj gönderen kişinin ekranında beklemeden görünsün.
  mutateCache<Message[]>(`messages:${input.roomId}`, (prev) => [
    ...(prev ?? []),
    { ...row, edited_at: null, deleted_at: null, created_at: new Date().toISOString(), message_hearts: [] },
  ]);
  const key = `messages:${input.roomId}`;
  // Bağlantı yoksa mesaj "Bekliyor" olarak kalır, bağlantı gelince gönderilir.
  if (isOffline()) {
    mutateCache<Message[]>(key, (prev) => (prev ?? []).map((m) => (m.id === row.id ? { ...m, pending: true } : m)));
    enqueue(row.id, async () => {
      const { error } = await supabase.from('messages').insert(row);
      if (error) throw error;
      mutateCache<Message[]>(key, (prev) =>
        (prev ?? []).map((m) => (m.id === row.id ? { ...m, pending: false, sentFromQueue: true } : m)),
      );
      setTimeout(() => invalidate(key, 'chatRooms'), 2000);
    });
    return null;
  }
  const { error } = await supabase.from('messages').insert(row);
  invalidate(key, 'chatRooms');
  return error;
}

export async function editMessage(message: Message, body: string) {
  mutateCache<Message[]>(`messages:${message.room_id}`, (prev) =>
    (prev ?? []).map((m) => (m.id === message.id ? { ...m, body, edited_at: new Date().toISOString() } : m)),
  );
  const { error } = await supabase.from('messages').update({ body }).eq('id', message.id);
  invalidate(`messages:${message.room_id}`, 'chatRooms');
  return error;
}

export async function deleteMessage(message: Message) {
  const { error } = await supabase.rpc('delete_message', { p_message: message.id });
  invalidate(`messages:${message.room_id}`, 'chatRooms');
  return error;
}

export async function toggleMessageHeart(message: Message, userId: string, liked: boolean) {
  mutateCache<Message[]>(`messages:${message.room_id}`, (prev) =>
    (prev ?? []).map((m) =>
      m.id !== message.id
        ? m
        : {
            ...m,
            message_hearts: liked
              ? m.message_hearts.filter((h) => h.user_id !== userId)
              : [...m.message_hearts, { user_id: userId }],
          },
    ),
  );
  const { error } = liked
    ? await supabase.from('message_hearts').delete().eq('message_id', message.id).eq('user_id', userId)
    : await supabase.from('message_hearts').insert({ message_id: message.id, user_id: userId });
  if (error) invalidate(`messages:${message.room_id}`);
  return error;
}

/** Odayı açınca okunmamış noktası kalkar. Başkasına "gördü" diye yansımaz. */
export async function markRead(roomId: string, userId: string) {
  mutateCache<RoomOverview[]>('chatRooms', (prev) =>
    (prev ?? []).map((r) => (r.room_id === roomId ? { ...r, unread: false } : r)),
  );
  await supabase
    .from('chat_reads')
    .upsert({ room_id: roomId, user_id: userId, last_read_at: new Date().toISOString() });
}

/** Odanın üyeleri (anma önerileri için). */
export async function fetchRoomMembers(roomId: string) {
  const rows = must<{ user_id: string }[]>(
    await supabase.from('chat_members').select('user_id').eq('room_id', roomId),
  );
  return rows.map((r) => r.user_id);
}
export const useRoomMembers = (roomId: string | undefined) =>
  useQuery(roomId ? `roomMembers:${roomId}` : null, () => fetchRoomMembers(roomId!));

export async function openDirectRoom(otherUserId: string) {
  const { data, error } = await supabase.rpc('open_direct_room', { p_other: otherUserId });
  if (error) throw error;
  invalidate('chatRooms');
  return data as string;
}

/** Görsel ya da ses kaydını "chat-files" kovasına yükler; dönüş dosya yolu. */
export async function uploadChatFile(
  roomId: string,
  body: Blob | Uint8Array,
  ext: string,
  contentType: string,
) {
  const path = `${roomId}/${uuid()}.${ext}`;
  const { error } = await supabase.storage
    .from('chat-files')
    .upload(path, body, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

/** Metindeki "@kullanıcıadı" parçaları (anma vurgusu için). */
export function splitMentions(body: string) {
  const parts: { text: string; mention?: string }[] = [];
  const re = /@([A-Za-z0-9._-]{3,32})/g;
  let last = 0;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    if (m.index > last) parts.push({ text: body.slice(last, m.index) });
    parts.push({ text: m[0], mention: m[1].toLowerCase() });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts;
}

/** Mesaj önizlemesi: oda listesi ve yanıt alıntısı. */
export function previewText(m: {
  body: string | null;
  attachment_kind?: string | null;
  deleted_at?: string | null;
}) {
  if (m.deleted_at) return 'Mesaj silindi';
  if (m.body) return m.body;
  if (m.attachment_kind === 'ses') return 'Sesli mesaj';
  if (m.attachment_kind === 'gorsel') return 'Görsel';
  return '';
}
