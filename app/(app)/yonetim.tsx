import { Redirect, useLocalSearchParams } from 'expo-router';

import { AdminPanel, type AdminTab } from '@/components/admin/AdminPanel';
import { Screen } from '@/components/layout/Screen';
import { useAuth } from '@/lib/auth';

const TABS: AdminTab[] = ['genel', 'istek', 'uye', 'proje', 'kilit', 'duyuru'];

/** Sadece yöneticiler görür; yetkisi olmayan bu adrese gelirse ana sayfaya (Akış) döner. */
export default function Yonetim() {
  const { profile } = useAuth();
  const { sekme, baslik, metin } = useLocalSearchParams<{ sekme?: string; baslik?: string; metin?: string }>();
  if (!profile) return null;
  if (!profile.is_admin) return <Redirect href="/akis" />;

  const initial = TABS.includes(sekme as AdminTab) ? (sekme as AdminTab) : 'genel';
  return (
    <Screen title="Yönetim paneli" crumb="Sadece yöneticiler görür">
      <AdminPanel
        key={`${initial}:${baslik ?? ''}`}
        initialTab={initial}
        announcementDraft={baslik ? { title: baslik, body: metin ?? '' } : undefined}
      />
    </Screen>
  );
}
