import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Button, Card, Chip, SectionTitle } from '@/components/ui/Controls';
import { Press } from '@/components/ui/Press';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { friendlyError } from '@/lib/errors';
import { NOTIFICATION_DOT, REQUEST_STATUS } from '@/lib/labels';
import { decideRequest, markAllNotificationsRead, useNotifications, useTasks } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import { dayLabel } from '@/lib/time';
import type { TeamRequest } from '@/lib/types';

export default function Bildirimler() {
  const say = useToast();
  const team = useTeam();
  const tasks = useTasks();
  const notes = useNotifications();
  // Sayfa açıldığında okunmamış olanlar bu ziyaret boyunca kalın kalsın, sonra okundu sayılsın.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (!team.meId) return;
      const timer = setTimeout(() => markAllNotificationsRead(team.meId), 1200);
      return () => clearTimeout(timer);
    }, [team.meId]),
  );

  const unreadNow = (notes.data ?? []).filter((n) => !n.read_at).map((n) => n.id);
  if (unreadNow.some((id) => !freshIds.has(id))) setFreshIds(new Set([...freshIds, ...unreadNow]));

  const taskTitle = (id: string | null) => (tasks.data ?? []).find((t) => t.id === id)?.title;
  const pending = team.requests.filter((r) => r.status === 'bekliyor');
  const mine = team.requests.filter((r) => r.requester_id === team.meId);

  async function decide(r: TeamRequest, approve: boolean) {
    const error = await decideRequest(r.id, approve);
    if (error) say(friendlyError(error));
    else say(approve ? `${team.nameOf(r.requester_id)} için kabul edildi` : 'Şimdilik olmadı dedin, nazikçe haber verildi');
  }

  const myText = (r: TeamRequest) =>
    r.kind === 'proje'
      ? `${team.projectMap.get(r.project_id ?? '')?.name ?? 'Bir'} projesine katılma isteği`
      : `“${taskTitle(r.task_id) ?? 'Bir görev'}” görev isteği`;

  return (
    <Screen title="Bildirimler" crumb="Son olanlar" back onRefresh={() => Promise.all([notes.refetch(), tasks.refetch()])}>
      {team.isAdmin ? (
        <View style={{ gap: 10 }}>
          <SectionTitle>Bekleyen istekler</SectionTitle>
          {pending.length === 0 && (
            <Txt size={14} color="muted">
              Bekleyen istek yok.
            </Txt>
          )}
          {pending.map((r) => {
            const who = team.person(r.requester_id);
            return (
              <Card key={r.id} radius={22} gap={12}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  {who && <Avatar person={who} size={40} />}
                  <Txt style={{ flex: 1 }}>{team.requestText(r, taskTitle(r.task_id))}</Txt>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button label="Kabul et" onPress={() => decide(r, true)} />
                  <Button label="Şimdilik değil" kind="soft" onPress={() => decide(r, false)} />
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <SectionTitle>İsteklerim</SectionTitle>
          {mine.length === 0 && (
            <Txt size={14} color="muted">
              Henüz istek göndermedin.
            </Txt>
          )}
          {mine.map((r) => {
            const st = REQUEST_STATUS[r.status];
            return (
              <Card key={r.id} radius={20} padding={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
                <Txt size={14.5} style={{ flex: 1 }}>
                  {myText(r)}
                </Txt>
                <Chip label={st.label} bg={st.bg} fg={st.fg} />
              </Card>
            );
          })}
        </View>
      )}

      <View style={{ gap: 10 }}>
        <SectionTitle>Son olanlar</SectionTitle>
        {notes.loading ? (
          <SkeletonCards count={2} lines={1} />
        ) : notes.error ? (
          <ErrorState message={notes.error} onRetry={notes.refetch} />
        ) : (notes.data ?? []).length === 0 ? (
          <EmptyState title="Bildirim yok" description="Biri seni anınca ya da işine dokununca burada görünür." />
        ) : (
          (notes.data ?? []).map((n) => (
            <Press
              key={n.id}
              onPress={() => n.link && router.navigate(n.link as Href)}
              hoverBg="hover"
              style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 4, borderRadius: 12 }}
            >
              <View style={{ width: 10, height: 10, marginTop: 6, borderRadius: 5, backgroundColor: NOTIFICATION_DOT[n.kind] }} />
              <View style={{ flex: 1 }}>
                <Txt size={14.5} weight={freshIds.has(n.id) ? 600 : 400}>
                  {n.text}
                </Txt>
                <Txt size={12.5} color="muted">
                  {dayLabel(n.created_at)}
                </Txt>
              </View>
            </Press>
          ))
        )}
      </View>
    </Screen>
  );
}
