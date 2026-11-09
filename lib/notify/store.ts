// Masaüstü bildirim kartları (0.9.0): bildirim penceresinde gösterilen kartların listesi.

import { createStore, useStore } from '@/lib/launcher/store';

export type NoticeKind = 'mesaj' | 'anma' | 'kalp' | 'gorev' | 'istek' | 'duyuru' | 'oylama' | 'diger';

export type Notice = {
  /** Kartın kimliği (mesaj ya da bildirim satırının id'si). */
  id: string;
  kind: NoticeKind;
  /** Gönderen / işi yapan kişi (avatar ve ad için). */
  actorId: string | null;
  /** Kart metni: mesaj önizlemesi ya da bildirim cümlesi. */
  text: string;
  /** Tıklanınca Merkez'de açılacak yol (ör. "/sohbet/<oda>?mesaj=<id>"). */
  link: string | null;
  createdAt: string;
  /** Sohbet mesajlarında oda bilgisi. */
  roomId?: string;
  messageId?: string;
  /** Görsel mesajda küçük resim yolu (chat-files kovası). */
  imagePath?: string | null;
  /** Kartın üst satırındaki kanal: "· #genel", "· Direkt mesaj". */
  channel?: string;
  /** notifications satırı (okundu yapmak için). */
  notificationId?: string;
  /** Aynı sohbetten kısa sürede gelen mesaj sayısı (kart güncellenir). */
  count: number;
};

const store = createStore<Notice[]>([]);
export const useNotices = () => useStore(store);
export const getNotices = store.get;

export function pushNotice(n: Omit<Notice, 'count'> & { count?: number }) {
  store.set((list) => [...list.filter((x) => x.id !== n.id), { count: 1, ...n }]);
}

export function updateNotice(id: string, patch: Partial<Notice>) {
  store.set((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)));
}

export function dismissNotice(id: string) {
  store.set((list) => list.filter((n) => n.id !== id));
}

export function clearNotices() {
  store.set([]);
}
