// ABN Merkez · push bildirimi gönderimi (Supabase Edge Function, Deno)
//
// notifications tablosuna her ekleme bir Database Webhook ile buraya gelir (bkz. supabase/README.md).
// Alıcının Android cihazlarındaki Expo push jetonlarına bildirimi gönderir.
//   · Moladaki kişiye push gönderilmez (uygulama içi bildirimi döndüğünde görür).
//   · Sohbet bildirimleri (anma) kişinin sessiz saatlerinde gönderilmez; uygulamada birikir.
//   · Artık kayıtlı olmayan jetonlar silinir.
// Ortam değişkenleri: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından verilir.
// PUSH_WEBHOOK_SECRET verilirse webhook isteğindeki "x-abn-secret" başlığı onunla aynı olmalıdır.

import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  text: string;
  link: string | null;
};

type WebhookPayload = { type: 'INSERT' | 'UPDATE' | 'DELETE'; table: string; record: NotificationRow | null };

/** Sessiz saatlere uyan bildirim türleri (sohbet). */
const CHAT_KINDS = new Set(['anma']);

/** Kişinin kendi saat diliminde şu anki saat sessiz aralıkta mı? 23 → 8 gibi gece yarısını aşan aralıklar da olur. */
function inQuietHours(start: number | null, end: number | null, timeZone: string, now = new Date()) {
  if (start === null || end === null || start === end) return false;
  let hour: number;
  try {
    hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now));
  } catch {
    hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Istanbul' }).format(now));
  }
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

const TITLES: Record<string, string> = {
  yorum: 'Yeni yorum',
  kalp: 'Bir kalp geldi',
  istek: 'Yeni istek',
  istek_cevap: 'İsteğine cevap',
  duyuru: 'Yeni duyuru',
  gorev_atama: 'Sana bir görev verildi',
  yardim: 'Yardım isteniyor',
  soru: 'Küçük bir soru',
  anma: 'Sohbette anıldın',
  oylama: 'Oylama sonuçlandı',
  diger: 'ABN Merkez',
};

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (secret && req.headers.get('x-abn-secret') !== secret) {
    return new Response('yetkisiz', { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('geçersiz istek', { status: 400 });
  }
  const n = payload.record;
  if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !n) {
    return new Response('yok sayıldı', { status: 200 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: profile } = await supabase
    .from('profiles')
    .select('availability, quiet_start, quiet_end, time_zone')
    .eq('id', n.user_id)
    .maybeSingle();
  if (profile?.availability === 'ara') {
    return new Response('molada, gönderilmedi', { status: 200 });
  }
  if (CHAT_KINDS.has(n.kind) && profile && inQuietHours(profile.quiet_start, profile.quiet_end, profile.time_zone)) {
    return new Response('sessiz saat, gönderilmedi', { status: 200 });
  }

  const { data: tokens, error } = await supabase.from('push_tokens').select('token').eq('user_id', n.user_id);
  if (error) return new Response(error.message, { status: 500 });
  if (!tokens?.length) return new Response('cihaz yok', { status: 200 });

  const messages = tokens.map((t) => ({
    to: t.token,
    title: TITLES[n.kind] ?? 'ABN Merkez',
    body: n.text,
    sound: 'default',
    channelId: 'varsayilan',
    data: { link: n.link ?? '/bildirimler', notificationId: n.id },
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const body = await res.json().catch(() => null);

  // Uygulaması silinmiş cihazların jetonları temizlenir.
  const results: { status: string; details?: { error?: string } }[] = body?.data ?? [];
  const dead = results
    .map((r, i) => (r.status === 'error' && r.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null))
    .filter((t): t is string => !!t);
  if (dead.length) await supabase.from('push_tokens').delete().in('token', dead);

  return new Response(JSON.stringify({ sent: messages.length, removed: dead.length }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
