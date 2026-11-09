// Android push bildirimleri (expo-notifications). Webde push yok; uygulama içi zil yeterli.
//
// Jeton Expo push servisinden alınır ve push_tokens tablosuna yazılır; gönderimi "push" Edge Function'ı
// yapar (supabase/functions/push). Jeton almak için app.json'da extra.eas.projectId gerekir; bu değer
// "eas init" ile eklenir (Aşama 7). Yoksa push sessizce atlanır, uygulama çalışmaya devam eder.

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

let configured = false;

/** Uygulama açıkken gelen bildirim de üstte görünsün. */
function configure() {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * İzin ister, jetonu alır ve kaydeder. Kişi izin vermezse bir daha sormaz; zorlamak yok.
 * Dönüş: kayıt yapıldıysa true.
 */
export async function registerForPush(userId: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !Device.isDevice) return false;
  configure();

  await Notifications.setNotificationChannelAsync('varsayilan', {
    name: 'ABN Merkez',
    importance: AndroidImportance.DEFAULT,
    lightColor: '#C5B5FA',
  });

  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return false;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ token, user_id: userId, platform: 'android', updated_at: new Date().toISOString() });
  return !error;
}

/** Çıkışta bu cihazın jetonu silinir ki başkasının bildirimleri gelmesin. */
export async function unregisterPush() {
  if (Platform.OS !== 'android' || !Device.isDevice) return;
  try {
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {
    // Jeton yoksa yapacak bir şey yok.
  }
}
