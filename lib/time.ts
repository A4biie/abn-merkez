// Prototipteki "2 saat önce", "Dün", "3 gün önce" gibi zaman ifadeleri.

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatDate(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function timeAgo(iso: string, now = new Date()) {
  const then = new Date(iso);
  const diff = now.getTime() - then.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Az önce';
  if (min < 60) return `${min} dakika önce`;
  const days = Math.round((startOfDay(now).getTime() - startOfDay(then).getTime()) / DAY);
  if (days === 0) return `${Math.floor(min / 60)} saat önce`;
  if (days === 1) return 'Dün';
  if (days < 7) return `${days} gün önce`;
  return formatDate(then);
}

/** Bildirim listesi için kısa gün ifadesi: Bugün, Dün, 3 gün önce. */
export function dayLabel(iso: string, now = new Date()) {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / DAY);
  if (days <= 0) return 'Bugün';
  if (days === 1) return 'Dün';
  if (days < 7) return `${days} gün önce`;
  return formatDate(iso);
}

/** Pazartesi başlayan bu hafta: { start, end, label: "26 Ekim – 1 Kasım" }. */
export function thisWeek(now = new Date()) {
  const today = startOfDay(now);
  const offset = (today.getDay() + 6) % 7;
  const start = new Date(today.getTime() - offset * DAY);
  const end = new Date(start.getTime() + 6 * DAY);
  return { start, end, label: `${formatDate(start)} – ${formatDate(end)}` };
}

export function daysSince(iso: string, now = new Date()) {
  return (now.getTime() - new Date(iso).getTime()) / DAY;
}
