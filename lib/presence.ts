// Anlık durum ve özel durum (profil 0.10.0). Renkler ve adlar design/abn-profil.html (ABN Profil Prototipi).

import type { PresenceStatus, Profile } from './types';

export const STATUS: Record<PresenceStatus, { label: string; color: string; desc?: string }> = {
  online: { label: 'Müsait', color: '#3BA55D' },
  busy: { label: 'Meşgul', color: '#ED4245', desc: 'Bildirimler sessize alınır' },
  idle: { label: 'Uzakta', color: '#F0A92E' },
  invisible: { label: 'Görünmez', color: '#80848E', desc: 'Başkalarına çevrimdışı görünürsün' },
};

export const STATUS_ORDER: PresenceStatus[] = ['online', 'busy', 'idle', 'invisible'];

type P = Pick<Profile, 'status' | 'custom_status' | 'custom_status_emoji' | 'custom_status_expires_at'>;

/** Süresi dolmamış özel durum ya da null. */
export function customStatus(p: P): { emoji: string; text: string } | null {
  if (!p.custom_status) return null;
  if (p.custom_status_expires_at && new Date(p.custom_status_expires_at).getTime() < Date.now()) return null;
  return { emoji: p.custom_status_emoji || '💬', text: p.custom_status };
}

/** Başkasının gözünden durum: görünmez kişi çevrimdışı (gri halka) görünür. */
export function statusOf(p: P, isMe: boolean): PresenceStatus {
  const s = p.status ?? 'online';
  return s === 'invisible' && !isMe ? 'invisible' : s;
}

/** Kartın altındaki tek satır: özel durum varsa o, yoksa durumun adı. */
export function statusLine(p: P, isMe = true): string {
  const c = customStatus(p);
  if (c) return c.emoji + ' ' + c.text;
  const s = statusOf(p, isMe);
  return s === 'invisible' && !isMe ? 'Çevrimdışı' : STATUS[s].label;
}

export const CS_EMOJIS = ['🎨', '🎧', '💻', '🎮', '☕', '📝', '😴', '🔥'];

export const CS_EXPIRY = [
  { value: '30', label: '30 dakika sonra temizle' },
  { value: '60', label: '1 saat sonra temizle' },
  { value: 'today', label: 'Bugün sonunda temizle' },
  { value: 'never', label: 'Temizleme' },
] as const;

export function expiryDate(v: (typeof CS_EXPIRY)[number]['value']): string | null {
  const now = new Date();
  if (v === 'never') return null;
  if (v === 'today') {
    now.setHours(23, 59, 59, 0);
    return now.toISOString();
  }
  return new Date(now.getTime() + Number(v) * 60_000).toISOString();
}

/** #RRGGBB rengi açar / koyulaştırır (prototipteki shade()). */
export function shade(hex: string, p: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = p < 0 ? 0 : 255;
  const t = Math.abs(p) / 100;
  r = Math.round((f - r) * t + r);
  g = Math.round((f - g) * t + g);
  b = Math.round((f - b) * t + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
