import { router } from 'expo-router';
import { View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { useIsWide } from '@/components/layout/useIsWide';
import { nextStep, ProgressBar } from '@/components/projects/ProjectParts';
import { AvatarStack } from '@/components/Social';
import { Chip } from '@/components/ui/Controls';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Txt } from '@/components/ui/Txt';
import { PROJECT_STATUS } from '@/lib/labels';
import { useTasks } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import type { Project } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';

export default function Projeler() {
  const wide = useIsWide();
  const team = useTeam();

  return (
    <Screen title="Projeler" crumb="Abby’s Nexus">
      {team.loading ? (
        <SkeletonCards count={3} lines={2} />
      ) : team.error ? (
        <ErrorState message={team.error} onRetry={team.refetch} />
      ) : (
        <View style={wide ? { flexDirection: 'row', flexWrap: 'wrap', gap: 18 } : { gap: 16 }}>
          {team.projects.map((p) => (
            <ProjectCard key={p.id} project={p} wide={wide} />
          ))}
          {team.projects.length === 0 && (
            <EmptyState
              title="Henüz proje yok"
              description={
                team.isAdmin ? 'İlk projeyi Yönetim paneli → Projeler’den açabilirsin.' : 'Bir proje açıldığında burada görünecek.'
              }
            />
          )}
        </View>
      )}
    </Screen>
  );
}

function ProjectCard({ project, wide }: { project: Project; wide: boolean }) {
  const { colors } = useTheme();
  const team = useTeam();
  const tasks = useTasks();
  const st = PROJECT_STATUS[project.status];
  const members = project.members.map((id) => team.person(id)).filter((p) => !!p);
  const notMember = !team.isAdmin && !project.members.includes(team.meId);
  const openCount = (tasks.data ?? []).filter((t) => t.project_id === project.id && t.status !== 'bitti').length;

  return (
    <Press
      onPress={() => router.navigate({ pathname: '/projeler/[id]', params: { id: project.id } })}
      bg="surface"
      shadow
      pressScale={wide ? 0.98 : 0.97}
      style={[
        { borderRadius: 26, padding: wide ? 22 : 18, gap: wide ? 14 : 12 },
        wide && { flexGrow: 1, flexBasis: 320, maxWidth: 520 },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt size={wide ? 21 : 20} weight={700} leading={1.25} style={{ flex: 1 }}>
          {project.name}
        </Txt>
        <Chip label={st.label} bg={st.bg} fg={st.fg} />
      </View>
      {wide && !!project.summary && (
        <Txt size={14} color="muted">
          {project.summary}
        </Txt>
      )}
      <Txt size={14} color={wide ? 'text' : 'muted'}>
        Sıradaki adım:{' '}
        <Txt size={14} weight={wide ? 700 : 400} color={wide ? 'text' : 'muted'}>
          {nextStep(project)}
        </Txt>
      </Txt>
      <ProgressBar pct={project.progress} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <AvatarStack people={members} size={wide ? 30 : 28} max={6} />
        </View>
        {wide && (
          <Txt size={13} color="muted">
            {openCount} açık görev
          </Txt>
        )}
        {notMember && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="lock" size={13} color={colors.muted} strokeWidth={2.2} />
            <Txt size={12.5} color="muted">
              {wide ? 'Ekibinde değilsin' : 'Bu projede değilsin'}
            </Txt>
          </View>
        )}
      </View>
    </Press>
  );
}
