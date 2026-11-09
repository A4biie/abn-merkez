import { useLocalSearchParams } from 'expo-router';

import { ProfileView } from '@/components/profile/ProfileView';

/** Ekipten birinin profili. */
export default function KisiProfili() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProfileView id={id} />;
}
