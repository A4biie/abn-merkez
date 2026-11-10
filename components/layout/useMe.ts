import { useAuth } from '@/lib/auth';
import type { Availability } from '@/lib/types';

/**
 * Giriş yapan kişinin gösterim bilgisi. Profil henüz yüklenmediyse (ya da veritabanında
 * yoksa) giriş e-postasındaki kullanıcı adından türetilmiş geçici bilgi döner; ekran boş kalmaz.
 */
export function useMe() {
  const { profile, session } = useAuth();
  if (profile) return profile;
  const email = session?.user.email ?? '';
  return {
    full_name: email.split('@')[0] || 'Ben',
    avatar_url: null as string | null,
    avatar_color: '#C5B5FA',
    availability: 'musait' as Availability,
    status: 'online' as const,
    is_admin: false,
  };
}
