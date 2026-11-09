// Bildirim penceresinin veri kaynağı (0.9.0): Supabase Realtime.
//  - notifications: kişinin kendi satırları (yorum, kalp, görev, istek, duyuru, oylama…)
//  - messages: üyesi olduğu sohbet odaları ve DM'ler (RLS sadece üyesi olduğu odaları gönderir).
//    Kendi mesajları gelmez. İçinde @kullanıcıadı geçen mesaj "anma" kartı olur; aynı anma için
//    tetikleyicinin yazdığı notifications satırı ikinci kez kart açmaz.
// Merkez penceresi açık ve kişi o sohbetin içindeyse o sohbetten kart gelmez.
// Bu dosya bildirim penceresinde çalışır; launcher ve Merkez kapalıyken de dinleme sürer.

import { invoke, isDesktop, listenDesktop } from '@/lib/desktop';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

import { getPrefs, isRoomMuted, type NotifyTypeKey } from './prefs';
import { inQuietHours } from './quiet';
import { pushNotice, type NoticeKind } from './store';

/** Bu tür şu an kart olarak gösterilsin mi? (ayarlar, sessiz mod, sessiz saatler) */
function allowed(kind: NoticeKind, profile: Profile): boolean {
  const p = getPrefs();
  if (!p.enabled || quiet || inQuietHours(profile, new Date())) return false;
  const key: NotifyTypeKey | null =
    kind === 'mesaj' ? 'mesaj' : kind === 'anma' ? 'anma' : kind === 'kalp' ? 'kalp'
    : kind === 'gorev' || kind === 'istek' ? 'gorev' : kind === 'duyuru' ? 'duyuru' : kind === 'oylama' ? 'oylama' : null;
  return key ? p.types[key] : true;
}

/** Oda adı önbelleği: "· #genel" ya da "· Direkt mesaj". */
const rooms = new Map<string, Promise<string>>();
function channelOf(roomId: string): Promise<string> {
  let r = rooms.get(roomId);
  if (!r) {
    r = Promise.resolve(
      supabase.from('chat_rooms').select('kind,title').eq('id', roomId).maybeSingle(),
    ).then(({ data }) =>
      !data ? '' : data.kind === 'ozel' ? '· Direkt mesaj' : '· #' + (data.title || (data.kind === 'genel' ? 'genel' : 'sohbet')),
    ).catch(() => '');
    rooms.set(roomId, r);
  }
  return r;
}

const KIND: Record<string, NoticeKind> = {
  yorum: 'diger',
  kalp: 'kalp',
  istek: 'istek',
  istek_cevap: 'istek',
  duyuru: 'duyuru',
  gorev_atama: 'gorev',
  oylama: 'oylama',
  yardim: 'diger',
  soru: 'diger',
  diger: 'diger',
};

/** Merkez penceresinin durumu: açık mı, hangi sayfada? (MerkezBridge "merkez://route" gönderir) */
const merkez = { open: false, path: '' };
listenDesktop<{ open: boolean }>('merkez://state', (s) => {
  merkez.open = s.open;
  if (!s.open) merkez.path = '';
});
listenDesktop<string>('merkez://route', (path) => {
  merkez.open = true;
  merkez.path = path;
});

/** Kişi şu an bu sohbetin içinde mi? */
function inRoom(roomId: string) {
  return merkez.open && merkez.path === `/sohbet/${roomId}`;
}

let quiet = false; // tepsideki "Sessiz mod"
listenDesktop<boolean>('launcher://quiet', (q) => (quiet = q));

async function refreshUnread(userId: string) {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  await invoke('set_tray_unread', { unread: (count ?? 0) > 0 }).catch(() => {});
}

/** Dinlemeyi başlatır; dönen fonksiyon kapatır. */
export function startFeed(profile: Profile): () => void {
  const me = profile.id;
  const mention = new RegExp(`@${profile.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  if (isDesktop)
    invoke<boolean>('quiet_mode')
      .then((q) => (quiet = q))
      .catch(() => {});
  refreshUnread(me);

  const channel = supabase
    .channel(`bildirim-penceresi:${me}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const m = payload.new as {
        id: string;
        room_id: string;
        author_id: string | null;
        body: string;
        attachment_kind: 'gorsel' | 'ses' | null;
        attachment_path: string | null;
        created_at: string;
      };
      if (!m.author_id || m.author_id === me) return;
      if (inRoom(m.room_id) || isRoomMuted(m.room_id)) return;
      const kind: NoticeKind = m.body && mention.test(m.body) ? 'anma' : 'mesaj';
      if (!allowed(kind, profile)) return;
      const text =
        m.body ||
        (m.attachment_kind === 'ses' ? 'Sesli mesaj' : m.attachment_kind === 'gorsel' ? 'Görsel' : '');
      channelOf(m.room_id).then((channel) => pushNotice({
        id: m.id,
        kind,
        channel,
        actorId: m.author_id,
        text,
        link: `/sohbet/${m.room_id}?mesaj=${m.id}`,
        createdAt: m.created_at,
        roomId: m.room_id,
        messageId: m.id,
        imagePath: m.attachment_kind === 'gorsel' ? m.attachment_path : null,
      }));
    })
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` },
      (payload) => {
        refreshUnread(me);
        const n = payload.new as {
          id: string;
          kind: string;
          actor_id: string | null;
          text: string;
          link: string | null;
          created_at: string;
        };
        if (n.kind === 'anma') return; // mesaj kartı zaten "anma" olarak açıldı
        const kind = KIND[n.kind] ?? 'diger';
        if (!allowed(kind, profile)) return;
        pushNotice({
          id: n.id,
          kind,
          actorId: n.actor_id,
          text: n.text,
          link: n.link,
          createdAt: n.created_at,
          notificationId: n.id,
        });
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` },
      () => refreshUnread(me),
    )
    .subscribe();
  const iv = setInterval(() => refreshUnread(me), 60_000);

  return () => {
    clearInterval(iv);
    channel.unsubscribe();
  };
}
