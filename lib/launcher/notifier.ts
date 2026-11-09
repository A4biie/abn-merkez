// Launcher arka planda (tepside bile) çalışırken yeni bildirimleri Windows bildirimi olarak gösterir.
// Yorum, kalp, duyuru, görev ataması ve @anma; profildeki sessiz saatlerde ve tepsideki "Sessiz mod"da gösterilmez.
// Okunmamış bildirim varsa tepsi simgesi noktalı olur.

import { invoke, isDesktop, listenDesktop } from '@/lib/desktop';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

const KINDS: Record<string, string> = {
  yorum: 'Yeni yorum',
  kalp: 'Kalp bıraktı',
  duyuru: 'Duyuru',
  gorev_atama: 'Sana görev atandı',
  anma: 'Senden bahsedildi',
};

/** Şu an kişinin sessiz saatlerinde mi? (profil saat dilimine göre; 23 → 9 gibi gece aralıkları da olur) */
export function inQuietHours(
  p: Pick<Profile, 'quiet_start' | 'quiet_end' | 'time_zone'>,
  now = new Date(),
): boolean {
  if (p.quiet_start == null || p.quiet_end == null || p.quiet_start === p.quiet_end) return false;
  let hour = now.getHours();
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hourCycle: 'h23',
        timeZone: p.time_zone || undefined,
      }).format(now),
    );
  } catch {
    // geçersiz saat dilimi: yerel saat
  }
  return p.quiet_start < p.quiet_end
    ? hour >= p.quiet_start && hour < p.quiet_end
    : hour >= p.quiet_start || hour < p.quiet_end;
}

async function refreshUnread(userId: string) {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  await invoke('set_tray_unread', { unread: (count ?? 0) > 0 }).catch(() => {});
}

/** Abonelik başlatır; dönen fonksiyon kapatır. */
export function startNotifier(profile: Profile): () => void {
  if (!isDesktop) return () => {};
  const userId = profile.id;
  let quiet = false;
  invoke<boolean>('quiet_mode')
    .then((q) => (quiet = q))
    .catch(() => {});
  const offQuiet = listenDesktop<boolean>('launcher://quiet', (q) => (quiet = q));

  refreshUnread(userId);
  const channel = supabase
    .channel(`masaustu:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        refreshUnread(userId);
        const n = payload.new as { kind: string; text: string; link: string | null };
        const title = KINDS[n.kind];
        if (!title || quiet || inQuietHours(profile)) return;
        invoke('notify', { title, body: n.text, path: n.link ?? '/bildirimler' }).catch(() => {});
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      () => refreshUnread(userId),
    )
    .subscribe();
  // Merkez'de okununca da güncel kalsın (yedek: dakikada bir).
  const iv = setInterval(() => refreshUnread(userId), 60_000);

  return () => {
    offQuiet();
    clearInterval(iv);
    channel.unsubscribe();
  };
}
