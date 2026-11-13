import type { Href } from 'expo-router';

import type { IconName } from '@/components/ui/Icon';

export type TabName = 'akis' | 'sohbet' | 'gorevler' | 'projeler' | 'panolar' | 'fikirler' | 'wiki' | 'dosyalar' | 'ekip';
export type HiddenRoute = 'index' | 'bildirimler' | 'profil' | 'yonetim' | 'ozet';

/**
 * Menü sekmeleri. Başlık ve alt satır Desktop.dc.html'deki titles nesnesinden.
 * phone: false olanlar telefondaki alt menüde yok (Fikirler, Akış'ın üstündeki butondan açılır),
 * böylece alt menü 6 sekmede kalır.
 */
export const TABS: {
  name: TabName;
  href: `/${TabName}`;
  label: string;
  icon: IconName;
  title: string;
  crumb: string;
  phone?: false;
  /** Yan menüde adın yanında rozet ("YENİ"). */
  badge?: string;
}[] = [
  { name: 'akis', href: '/akis', label: 'Akış', icon: 'akis', title: 'Akış', crumb: 'Ekipten son paylaşımlar' },
  { name: 'sohbet', href: '/sohbet', label: 'Sohbet', icon: 'sohbet', title: 'Sohbet', crumb: 'Genel, projeler ve özel mesajlar' },
  { name: 'gorevler', href: '/gorevler', label: 'Görevler', icon: 'gorev', title: 'Görevler', crumb: 'Pano' },
  { name: 'projeler', href: '/projeler', label: 'Projeler', icon: 'proje', title: 'Projeler', crumb: 'Abby’s Nexus' },
  {
    name: 'panolar',
    href: '/panolar',
    label: 'Panolar',
    icon: 'pano',
    title: 'Panolar',
    crumb: 'Referans, taslak, hikâye akışı',
  },
  { name: 'fikirler', href: '/fikirler', label: 'Fikirler', icon: 'fikir', title: 'Fikir Defteri', crumb: 'Kaybolmasın diye', phone: false },
  { name: 'wiki', href: '/wiki', label: 'Wiki', icon: 'note', title: 'Wiki', crumb: 'Ekip bilgisi', phone: false, badge: 'YENİ' },
  { name: 'dosyalar', href: '/dosyalar', label: 'Dosyalar', icon: 'file', title: 'Dosyalar', crumb: 'Bütün yüklenenler', phone: false, badge: 'YENİ' },
  { name: 'ekip', href: '/ekip', label: 'Ekip', icon: 'ekip', title: 'Ekip', crumb: 'Ekip' },
];

export const PHONE_TABS = TABS.filter((t) => t.phone !== false);

/** Menüde görünmeyen ama aynı iskeletin içinde açılan sayfalar. */
export const HIDDEN_ROUTES: { name: HiddenRoute; href: Href }[] = [
  { name: 'index', href: '/' },
  { name: 'bildirimler', href: '/bildirimler' },
  { name: 'profil', href: '/profil' },
  { name: 'yonetim', href: '/yonetim' },
  { name: 'ozet', href: '/ozet' },
];

/** Adres çubuğundaki yoldan seçili sekmeyi bulur ("/projeler/abc" → projeler). */
export function activeTab(pathname: string): TabName | null {
  const first = pathname.split('/').filter(Boolean)[0];
  return TABS.find((t) => t.name === first)?.name ?? null;
}
