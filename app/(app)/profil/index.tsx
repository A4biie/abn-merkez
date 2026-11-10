import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import { openEditor, openProfile } from '@/lib/profileModal';

/** Eski "/profil" bağlantıları (Launcher dahil): profil penceresini açıp ana sayfaya döner. ?duzenle=1 düzenlemeyi açar. */
export default function Profilim() {
  const { profile } = useAuth();
  const { duzenle } = useLocalSearchParams<{ duzenle?: string }>();
  useEffect(() => {
    if (!profile) return;
    if (duzenle) openEditor();
    else openProfile(profile.id);
    router.replace('/');
  }, [profile, duzenle]);
  return null;
}
