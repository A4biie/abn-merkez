// Sessiz saatler (profildeki ayar): bu saatlerde bildirim kartı gösterilmez, ses çalmaz.

import type { Profile } from '@/lib/types';

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
