import { AVAILABILITY } from '@/lib/labels';
import { formatDate } from '@/lib/time';
import type { Profile } from '@/lib/types';

/** "Molada · 15 Ocak" ya da profilde "Molada · 15 Ocak’ta dönüyor". Kişinin kendisine tarih gösterilmez. */
export function availabilityLabel(p: Pick<Profile, 'availability' | 'availability_until'>, isMe: boolean, long = false) {
  const base = AVAILABILITY[p.availability].label;
  if (p.availability !== 'ara' || !p.availability_until || isMe) return base;
  const date = formatDate(p.availability_until);
  return long ? `${base} · ${date}’ta dönüyor` : `${base} · ${date}`;
}
