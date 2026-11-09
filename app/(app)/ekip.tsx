import { router } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { useIsWide } from '@/components/layout/useIsWide';
import { paint } from '@/components/ui/Controls';
import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { Press } from '@/components/ui/Press';
import { Txt } from '@/components/ui/Txt';
import { availabilityLabel } from '@/components/profile/availability';
import { AVAILABILITY, BANNER } from '@/lib/labels';
import { useProfitShares, useTasks } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import type { Profile } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';

export default function Ekip() {
  const wide = useIsWide();
  const team = useTeam();
  const people = [...team.people.values()];

  return (
    <Screen title="Ekip" crumb={`${people.length} kişi`}>
      {team.loading ? (
        <SkeletonCards count={4} lines={1} />
      ) : team.error ? (
        <ErrorState message={team.error} onRetry={team.refetch} />
      ) : (
        <View style={wide ? { flexDirection: 'row', flexWrap: 'wrap', gap: 18 } : { gap: 16 }}>
          {people.map((p) => (wide ? <WideCard key={p.id} person={p} /> : <PhoneCard key={p.id} person={p} />))}
        </View>
      )}
      {team.isAdmin && !wide && (
        <Txt size={13} color="muted">
          Kâr payı ve katkı bilgisini sadece sen görüyorsun.
        </Txt>
      )}
    </Screen>
  );
}

function useMemberInfo(person: Profile) {
  const team = useTeam();
  const projects = team.projects.filter((pr) => pr.members.includes(person.id)).map((pr) => pr.name);
  const name = person.full_name + (person.id === team.meId ? ' (sen)' : '');
  const avail = AVAILABILITY[person.availability];
  const availText = availabilityLabel(person, person.id === team.meId);
  return { team, projects, name, avail, availText };
}

function ProjectChips({ names, size = 12.5 }: { names: string[]; size?: number }) {
  if (names.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {names.map((n) => (
        <Box key={n} bg="surface2" style={{ borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 }}>
          <Txt size={size} weight={600} color="text-2" leading={1.3}>
            {n}
          </Txt>
        </Box>
      ))}
    </View>
  );
}

function AvailDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Txt size={13} weight={600} color="text-2">
        {label}
      </Txt>
    </View>
  );
}

const openProfile = (id: string) => router.navigate({ pathname: '/profil/[id]', params: { id } });

function PhoneCard({ person }: { person: Profile }) {
  const { team, projects, name, avail, availText } = useMemberInfo(person);
  const shares = useProfitShares();
  const tasks = useTasks();
  const done = (tasks.data ?? []).filter((t) => t.assignee_id === person.id && t.status === 'bitti').length;
  const rate = shares.data?.[person.id];

  return (
    <Box bg="surface" shadow style={{ borderRadius: 24, padding: 16, gap: 12 }}>
      <Press onPress={() => openProfile(person.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar person={person} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={17} weight={700}>
            {name}
          </Txt>
          <Txt size={13.5} color="muted">
            {person.role_title}
          </Txt>
        </View>
        <AvailDot color={avail.color} label={availText} />
      </Press>
      <ProjectChips names={projects} />
      {team.isAdmin && (
        <Box border="line" style={{ flexDirection: 'row', gap: 16, borderWidth: 0, borderTopWidth: 1, paddingTop: 10 }}>
          <Txt size={13} color="muted">
            Kâr payı:{' '}
            <Txt size={13} weight={700}>
              {rate == null ? '—' : `%${rate}`}
            </Txt>
          </Txt>
          <Txt size={13} color="muted">
            Bitirdiği görev:{' '}
            <Txt size={13} weight={700}>
              {done}
            </Txt>
          </Txt>
        </Box>
      )}
    </Box>
  );
}

function WideCard({ person }: { person: Profile }) {
  const { colors } = useTheme();
  const { projects, name, avail, availText } = useMemberInfo(person);
  const banner = BANNER[person.banner_color];

  return (
    <Press
      onPress={() => openProfile(person.id)}
      bg="surface"
      shadow
      pressScale={0.98}
      style={{ borderRadius: 24, overflow: 'hidden', flexGrow: 1, flexBasis: 260, maxWidth: 420 }}
    >
      <View style={{ height: 70, backgroundColor: paint(colors, banner.bg) }} />
      <View style={{ paddingHorizontal: 18, paddingBottom: 18, marginTop: -30, gap: 10 }}>
        <View style={{ alignSelf: 'flex-start', borderRadius: 34, borderWidth: 4, borderColor: colors.surface }}>
          <Avatar person={person} size={52} />
        </View>
        <View>
          <Txt size={18} weight={700}>
            {name}
          </Txt>
          <Txt size={13.5} color="muted">
            {person.role_title}
          </Txt>
        </View>
        <AvailDot color={avail.color} label={availText} />
        {!!person.bio && (
          <Txt size={13.5} color="text-3">
            {person.bio}
          </Txt>
        )}
        <ProjectChips names={projects} size={12} />
      </View>
    </Press>
  );
}
