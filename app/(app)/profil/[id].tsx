import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { openProfile } from '@/lib/profileModal';

/** Eski "/profil/<id>" bağlantıları: o kişinin profil penceresini açıp ana sayfaya döner. */
export default function KisiProfili() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => {
    openProfile(id);
    router.replace('/');
  }, [id]);
  return null;
}
