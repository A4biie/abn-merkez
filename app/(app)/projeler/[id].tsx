import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { useIsWide } from '@/components/layout/useIsWide';
import { Milestones } from '@/components/projects/ProjectParts';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { Button, Card, Chip, SectionTitle } from '@/components/ui/Controls';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { friendlyError } from '@/lib/errors';
import { PROJECT_STATUS } from '@/lib/labels';
import { fetchProjectBoardId, sendRequest, useTasks } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import type { Project } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProjeDetay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const wide = useIsWide();
  const team = useTeam();
  const project = team.projectMap.get(id);

  if (team.loading) {
    return (
      <Screen title="Proje" crumb="Projeler" back="Projeler">
        <SkeletonCards count={2} />
      </Screen>
    );
  }
  if (!project) {
    return (
      <Screen title="Proje" crumb="Projeler" back="Projeler">
        <ErrorState
          message={team.error ?? 'Bu proje bulunamadı. Silinmiş ya da adresi değişmiş olabilir.'}
          onRetry={team.error ? team.refetch : undefined}
        />
      </Screen>
    );
  }

  return wide ? <Wide project={project} /> : <Phone project={project} />;
}

function useProjectView(project: Project) {
  const team = useTeam();
  const say = useToast();
  const tasks = useTasks();
  const [opening, setOpening] = useState(false);

  const notMember = !team.isAdmin && !project.members.includes(team.meId);
  const joinPending = team.joinPending(project.id);
  const members = project.members.map((id) => team.person(id)).filter((p) => !!p);
  const projectTasks = (tasks.data ?? []).filter((t) => t.project_id === project.id);
  const lead = team.leadName(project.id);

  async function join() {
    if (joinPending) return;
    const error = await sendRequest({ userId: team.meId, kind: 'proje', projectId: project.id });
    say(error ? friendlyError(error) : 'İstek proje yöneticisine gitti');
  }

  async function openBoard() {
    if (opening) return;
    setOpening(true);
    try {
      const boardId = await fetchProjectBoardId(project.id);
      if (boardId) router.navigate({ pathname: '/panolar', params: { pano: boardId } });
      else {
        say('Bu projenin henüz panosu yok. Panolar’dan yeni bir tane açabilirsin.');
        router.navigate('/panolar');
      }
    } catch (e) {
      say(friendlyError(e));
    } finally {
      setOpening(false);
    }
  }

  return { team, tasks, notMember, joinPending, members, projectTasks, lead, join, openBoard };
}

function JoinCard({ project, v }: { project: Project; v: ReturnType<typeof useProjectView> }) {
  return (
    <Card radius={22} gap={10}>
      <Txt weight={700}>Bu projenin ekibinde değilsin</Txt>
      <Txt size={14} color="muted">
        Görevlerini görebilirsin ama alamazsın. Katılmak istersen proje yöneticisi {v.team.leadDative(project.id)} istek
        gönder.
      </Txt>
      <Button
        label={v.joinPending ? 'İstek gönderildi' : 'Projeye katılmak istiyorum'}
        kind={v.joinPending ? 'muted' : 'primary'}
        disabled={v.joinPending}
        onPress={v.join}
        style={{ alignSelf: 'flex-start' }}
      />
    </Card>
  );
}

function MemberList({ v }: { v: ReturnType<typeof useProjectView> }) {
  return (
    <Card radius={22} gap={10}>
      <Txt weight={700}>Ekip</Txt>
      {v.members.map((m) => (
        <Press
          key={m.id}
          onPress={() => router.navigate({ pathname: '/profil/[id]', params: { id: m.id } })}
          hoverBg="hover"
          style={{ borderRadius: 12, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Avatar person={m} size={32} />
          <View style={{ flex: 1 }}>
            <Txt size={14} weight={600}>
              {m.full_name}
              {m.id === v.team.meId ? ' (sen)' : ''}
            </Txt>
            <Txt size={12.5} color="muted">
              {m.role_title}
            </Txt>
          </View>
        </Press>
      ))}
    </Card>
  );
}

function Phone({ project }: { project: Project }) {
  const { colors } = useTheme();
  const v = useProjectView(project);
  const st = PROJECT_STATUS[project.status];

  return (
    <Screen title={project.name} back="Projeler" bare={false}>
      <View style={{ gap: 6, marginTop: -12 }}>
        <Chip label={st.label} bg={st.bg} fg={st.fg} />
        {!!project.summary && <Txt color="muted">{project.summary}</Txt>}
      </View>
      <Press
        onPress={v.openBoard}
        bg="a3"
        style={{ borderRadius: 22, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="pano" size={20} color={colors['a3-ink']} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight={700} color="a3-ink">
            Projenin panosu
          </Txt>
          <Txt size={13} color="a3-ink" style={{ opacity: 0.8 }}>
            Referanslar, taslaklar, hikâye akışı
          </Txt>
        </View>
        <Icon name="chevron" size={20} color={colors['a3-ink']} strokeWidth={2} />
      </Press>
      {v.notMember && <JoinCard project={project} v={v} />}
      <Card radius={26} padding={18} gap={4}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 }}>
          <Txt size={18} weight={600} style={{ flex: 1 }}>
            Kilometre taşları
          </Txt>
          <Txt weight={700} style={{ fontVariant: ['tabular-nums'] }}>
            %{project.progress}
          </Txt>
        </View>
        <Milestones items={project.milestones} />
      </Card>
      <SectionTitle>Görevler</SectionTitle>
      {v.projectTasks.length === 0 && <EmptyState title="Bu projede görev yok" description="İlk görevi eklediğinde burada görünecek." />}
      {v.projectTasks.map((t) => (
        <Card key={t.id} radius={20} padding={14} style={{ paddingHorizontal: 16 }}>
          <TaskCard task={t} variant="row" />
        </Card>
      ))}
      <MemberList v={v} />
    </Screen>
  );
}

function Wide({ project }: { project: Project }) {
  const v = useProjectView(project);
  const st = PROJECT_STATUS[project.status];

  return (
    <Screen title={project.name} crumb="Projeler" back="Tüm projeler">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: -6 }}>
        <Chip label={st.label} bg={st.bg} fg={st.fg} />
        <Txt size={14} color="muted" style={{ flex: 1 }}>
          {project.summary}
          {project.summary ? ' · ' : ''}Yönetici: {v.lead}
        </Txt>
        <Button label="Projenin panosu" kind="cyan" icon="pano" onPress={v.openBoard} />
      </View>
      <View style={{ flexDirection: 'row', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <View style={{ flexGrow: 999, flexShrink: 1, flexBasis: 460, minWidth: 0, gap: 18 }}>
          <Card radius={24} padding={20} gap={14}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Txt size={18} weight={700} style={{ flex: 1 }}>
                Kilometre taşları
              </Txt>
              <Txt weight={700} style={{ fontVariant: ['tabular-nums'] }}>
                %{project.progress}
              </Txt>
            </View>
            <Milestones items={project.milestones} horizontal />
          </Card>
          <Card radius={24} padding={0} gap={0} style={{ paddingVertical: 8, paddingHorizontal: 20 }}>
            {v.projectTasks.length === 0 && (
              <EmptyState title="Bu projede görev yok" description="İlk görevi eklediğinde burada görünecek." />
            )}
            {v.projectTasks.map((t, i) => (
              <Box
                key={t.id}
                border={i < v.projectTasks.length - 1 ? 'line' : undefined}
                style={{ paddingVertical: 12, borderWidth: 0, borderBottomWidth: i < v.projectTasks.length - 1 ? 1 : 0 }}
              >
                <TaskCard task={t} variant="row" />
              </Box>
            ))}
          </Card>
        </View>
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 280, maxWidth: 360, minWidth: 0, gap: 16 }}>
          {v.notMember && <JoinCard project={project} v={v} />}
          <MemberList v={v} />
        </View>
      </View>
    </Screen>
  );
}
