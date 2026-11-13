import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/lib/auth';
import { registerForPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { invalidate } from '@/lib/useQuery';

/**
 * Görünmez yardımcı: yeni bildirim gelince zil ve listeler sayfa yenilenmeden güncellenir,
 * Android'de push kaydı yapılır ve push'a dokununca ilgili sayfa açılır.
 */
export function NotificationsLive() {
  const { session } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`zil:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () =>
        invalidate('notifications', 'requests', 'tasks'),
      )
      .subscribe();
    // Sohbet: RLS sayesinde sadece üyesi olunan odaların mesajları gelir.
    const chat = supabase
      .channel(`sohbet:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        const row = (payload.new ?? payload.old) as { room_id?: string };
        invalidate('chatRooms', row.room_id ? `messages:${row.room_id}` : 'messages');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_hearts' }, () => invalidate('messages'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'polls' }, () => invalidate('polls', 'feed'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => invalidate('tasks'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas' }, () => invalidate('ideas'))
      .subscribe();
    registerForPush(userId).catch(() => {});
    return () => {
      channel.unsubscribe();
      chat.unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const link = res.notification.request.content.data?.link;
      if (typeof link === 'string') router.navigate(link as Href);
    });
    return () => sub.remove();
  }, []);

  return null;
}
