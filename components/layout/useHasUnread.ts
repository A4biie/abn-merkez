import { useNotifications } from '@/lib/queries';

/** Okunmamış bildirim var mı? Zildeki nokta için. Sayı gösterilmez. */
export function useHasUnread() {
  const { data } = useNotifications();
  return !!data?.some((n) => !n.read_at);
}
