import { ProfileView } from '@/components/profile/ProfileView';
import { useAuth } from '@/lib/auth';

/** Kendi profilim. */
export default function Profilim() {
  const { profile } = useAuth();
  return <ProfileView id={profile?.id} />;
}
