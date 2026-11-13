// Görevler · Liste görünümü (0.11 bölüm 2, design/abn-09.html: .lrow). Onay kutusu, başlık, durum etiketi, son tarih, avatar.
// Onay kutusu kendi görevini (ya da yöneticiyse herkesinkini) "Bitti"ye alır / geri açar.

import { View } from 'react-native';

import { PresenceAvatar } from '@/components/profile/ProfileCard';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { TASK_STATUS } from '@/lib/labels';
import { openProfile } from '@/lib/profileModal';
import { moveTask } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import type { Task } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';

export function TaskList({ tasks }: { tasks: Task[] }) {
  const { colors } = useTheme();
  const team = useTeam();
  const say = useToast();
  if (!tasks.length)
    return (
      <Txt color="muted" style={{ padding: 40, textAlign: 'center' }}>
        Görev yok.
      </Txt>
    );
  return (
    <View style={{ gap: 6 }}>
      {tasks.map((t) => {
        const st = TASK_STATUS[t.status];
        const done = t.status === 'bitti';
        const who = team.person(t.assignee_id);
        const mine = t.assignee_id === team.meId || team.isAdmin;
        return (
          <View
            key={t.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: colors.surface,
            }}
          >
            <Press
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done, disabled: !mine }}
              accessibilityLabel={done ? 'Yeniden aç' : 'Bitti olarak işaretle'}
              onPress={() => {
                if (!mine) return say('Bu görevi sadece üzerindeki kişi değiştirebilir');
                moveTask(t, done ? 'bende' : 'bitti', t.position).then((err) => {
                  if (err) say('Görev güncellenemedi');
                  else if (!done) say(`"${t.title}" bitti 🎉`);
                });
              }}
              style={{
                width: 18,
                height: 18,
                borderRadius: 6,
                backgroundColor: done ? colors.a1 : undefined,
                boxShadow: done ? undefined : `inset 0 0 0 2px ${colors.muted}`,
                opacity: mine ? 1 : 0.5,
              }}
            />
            <Txt weight={700} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
              {t.title}
            </Txt>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: colors.chip,
                width: 120,
              }}
            >
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: st.dot }} />
              <Txt size={11.5} weight={800} color="text-2" numberOfLines={1}>
                {st.label}
              </Txt>
            </View>
            <Txt size={13} color="muted" numberOfLines={1} style={{ width: 90 }}>
              {t.due_label || '—'}
            </Txt>
            <View style={{ width: 34, alignItems: 'flex-end' }}>
              {who ? (
                <Press onPress={() => openProfile(who.id)} accessibilityLabel={who.full_name + ' profili'}>
                  <PresenceAvatar person={who} size={24} isMe={who.id === team.meId} ring={colors.surface} dot={false} />
                </Press>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
