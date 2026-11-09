// Veritabanındaki anahtarların ekrandaki Türkçe karşılıkları (prototype/*.html ile aynı metinler).
// Renkler tema token'ı ([token]) ya da prototipteki sabit renkle verilir.

import type { Token } from '@/theme/themes';
import type {
  Availability,
  BannerColor,
  IdeaStatus,
  NotificationKind,
  ProjectStatus,
  RequestStatus,
  TaskStatus,
} from './types';

export const AVAILABILITY: Record<Availability, { label: string; color: string }> = {
  musait: { label: 'Müsait', color: '#B5D334' },
  yogun: { label: 'Az vaktim var', color: '#3FC3D6' },
  ara: { label: 'Molada', color: '#E9A23B' },
};

type ChipColors = { label: string; bg: Token | string; fg: Token | string };

export const PROJECT_STATUS: Record<ProjectStatus, ChipColors> = {
  fikir: { label: 'Fikir', bg: 'a3', fg: 'a3-ink' },
  gelistirmede: { label: 'Geliştirmede', bg: 'a2', fg: 'a2-ink' },
  test: { label: 'Test', bg: '#F5C77E', fg: '#0E0E10' },
  beklemede: { label: 'Beklemede', bg: 'chip', fg: 'text-2' },
  yayinda: { label: 'Yayında', bg: 'a1', fg: 'a1-ink' },
  rafta: { label: 'Rafa kalktı', bg: 'chip', fg: 'text-3' },
};

// Prototipteki yapilacak/devam/inceleme/bitti → havuz/bende/incelemede/bitti.
export const TASK_STATUS: Record<TaskStatus, ChipColors & { dot: string; next?: string }> = {
  havuz: { label: 'Yapılacak', bg: 'chip', fg: 'text-2', dot: '#A1A1AA' },
  bende: { label: 'Devam ediyor', bg: 'a2', fg: 'a2-ink', dot: '#A794F0', next: 'İncelemeye gönder' },
  incelemede: { label: 'İncelemede', bg: 'a3', fg: 'a3-ink', dot: '#3FC3D6', next: 'Bitir' },
  bitti: { label: 'Bitti', bg: 'a1', fg: 'a1-ink', dot: '#B5D334' },
};

export const TASK_ORDER: TaskStatus[] = ['havuz', 'bende', 'incelemede', 'bitti'];

export const IDEA_STATUS: Record<IdeaStatus, ChipColors> = {
  yeni: { label: 'Yeni', bg: 'a3', fg: 'a3-ink' },
  konusuluyor: { label: 'Konuşuluyor', bg: 'a2', fg: 'a2-ink' },
  gorev: { label: 'Göreve dönüştü', bg: 'a1', fg: 'a1-ink' },
  simdilik: { label: 'Şimdilik değil', bg: 'chip', fg: 'text-3' },
};

export const REQUEST_STATUS: Record<RequestStatus, ChipColors> = {
  bekliyor: { label: 'Bekliyor', bg: 'chip', fg: 'text-2' },
  onaylandi: { label: 'Kabul edildi', bg: 'a1', fg: 'a1-ink' },
  reddedildi: { label: 'Şimdilik olmadı', bg: 'chip', fg: 'text-3' },
};

export const BANNER: Record<BannerColor, { bg: Token | string; ink: Token | string; label: string }> = {
  lilac: { bg: 'a2', ink: 'a2-ink', label: 'Tema rengi 2' },
  lime: { bg: 'a1', ink: 'a1-ink', label: 'Tema rengi 1' },
  cyan: { bg: 'a3', ink: 'a3-ink', label: 'Tema rengi 3' },
  gece: { bg: '#2B2540', ink: '#C5B5FA', label: 'Gece' },
};

export const NOTIFICATION_DOT: Record<NotificationKind, string> = {
  yardim: '#E9A23B',
  istek: '#A794F0',
  istek_cevap: '#B5D334',
  kalp: '#E06C9F',
  yorum: '#3FC3D6',
  duyuru: '#B5D334',
  gorev_atama: '#A794F0',
  soru: '#3FC3D6',
  diger: '#B5D334',
};

/** "Rüzgar" → "R". Türkçe büyük harf kuralıyla (i → İ). */
export function initial(name: string) {
  return (name.trim().charAt(0) || '?').toLocaleUpperCase('tr');
}

/** Türkçe yönelme eki (veritabanındaki tr_dative ile aynı): Rüzgar'a, Ece'ye. */
export function dative(name: string) {
  const low = name.trim().toLocaleLowerCase('tr');
  if (!low) return name;
  const vowel = low.match(/[aıoueiöü](?=[^aıoueiöü]*$)/)?.[0];
  let suffix = vowel && 'aıou'.includes(vowel) ? 'a' : 'e';
  if ('aıoueiöü'.includes(low.slice(-1))) suffix = 'y' + suffix;
  return `${name.trim()}’${suffix}`;
}
