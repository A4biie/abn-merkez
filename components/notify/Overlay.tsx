// Bildirim penceresi (Tauri "bildirim", 0.9.0). Kartlar sağ altta, görev çubuğunun üstünde yığılır.
// Pencere içeriğin boyuna göre ölçülür; kart yokken ekran dışına çekilir (tıklamalar arkaya geçer).
// Bölüm 1: altyapı ve sade kart. Tasarım, türler, hareket ve etkileşim sonraki bölümlerde.

import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Controls';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/auth';
import { invoke, isDesktop, notifyDemo } from '@/lib/desktop';
import { startFeed } from '@/lib/notify/feed';
import { dismissNotice, pushNotice, useNotices, type Notice } from '@/lib/notify/store';
import { useTeam } from '@/lib/team';
import { useTheme } from '@/theme/ThemeProvider';

const MAX_VISIBLE = 3;
const DURATION = 6000;
const PAD = 16;

export function NotifyOverlay() {
  const { profile } = useAuth();
  const notices = useNotices();
  const visible = notices.slice(-MAX_VISIBLE);

  // Pencere şeffaf: sayfanın zemini görünmesin.
  useEffect(() => {
    for (const el of [document.documentElement, document.body, document.getElementById('root')]) {
      if (el) el.style.background = 'transparent';
    }
  }, []);

  // Realtime dinleme: oturum açıksa.
  useEffect(() => (profile && (isDesktop || notifyDemo) ? startFeed(profile) : undefined), [profile]);

  // Süre dolunca kart kapanır (bölüm 4'te üzerine gelince durma ve ayarlanabilir süre gelecek).
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const map = timers.current;
    for (const n of visible)
      if (!map.has(n.id))
        map.set(
          n.id,
          setTimeout(() => dismissNotice(n.id), DURATION),
        );
    for (const [id, t] of map) {
      if (notices.some((n) => n.id === id)) continue;
      clearTimeout(t);
      map.delete(id);
    }
  }, [notices, visible]);

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' }}>
      {notifyDemo && <DemoPanel />}
      <View
        style={{ padding: PAD, gap: 10 }}
        onLayout={(e) => {
          const h = visible.length ? e.nativeEvent.layout.height : 0;
          if (isDesktop) invoke('notif_layout', { height: h, corner: 'sag-alt' }).catch(() => {});
        }}
      >
        {visible.map((n) => (
          <PlainCard key={n.id} n={n} />
        ))}
      </View>
    </View>
  );
}

function PlainCard({ n }: { n: Notice }) {
  const { colors } = useTheme();
  const team = useTeam();
  const actor = n.actorId ? team.person(n.actorId) : undefined;
  return (
    <View
      style={{
        width: 360,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors['line-2'],
        padding: 14,
        flexDirection: 'row',
        gap: 12,
        boxShadow: '0 18px 40px rgba(0,0,0,.35)',
      }}
    >
      {actor && <Avatar person={actor} size={40} />}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt size={14} weight={800} numberOfLines={1}>
          {actor?.full_name ?? 'ABN Merkez'}
        </Txt>
        <Txt size={13.5} color="text-2" numberOfLines={2}>
          {n.text}
        </Txt>
      </View>
    </View>
  );
}

/** Tarayıcıda denemek için: örnek kart ekler (http://localhost:8081/?bildirim). */
function DemoPanel() {
  const team = useTeam();
  const list = [...team.people.values()];
  const someone = list.find((p) => p.id !== team.meId) ?? list[0];
  return (
    <View style={{ position: 'absolute', top: 16, left: 16, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <Button
        label="Mesaj kartı"
        size="sm"
        onPress={() =>
          pushNotice({
            id: `demo-${Date.now()}`,
            kind: 'mesaj',
            actorId: someone?.id ?? null,
            text: 'Yüz ifadelerinin ikinci turu hazır, bakabilir misin?',
            link: '/sohbet',
            createdAt: new Date().toISOString(),
          })
        }
      />
    </View>
  );
}
