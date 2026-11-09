import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { Icon } from '@/components/ui/Icon';
import type { RoomOverview } from '@/lib/chat';
import type { useTeam } from '@/lib/team';
import { useTeam as useTeamHook } from '@/lib/team';
import { useTheme } from '@/theme/ThemeProvider';

type Team = ReturnType<typeof useTeam>;

export function roomTitle(room: RoomOverview, team: Team) {
  if (room.kind === 'genel') return 'Genel';
  if (room.kind === 'ozel') return team.nameOf(room.other_user);
  return room.title || 'Proje';
}

export function roomSubtitle(room: RoomOverview, memberCount?: number) {
  if (room.kind === 'genel') return 'Bütün ekip';
  if (room.kind === 'ozel') return 'Özel mesaj';
  return memberCount ? `Proje sohbeti · ${memberCount} kişi` : 'Proje sohbeti';
}

/** Oda simgesi: genel ve proje için renkli daire, özel odada kişinin avatarı. */
export function RoomIcon({ room, size = 44 }: { room: RoomOverview; size?: number }) {
  const { colors } = useTheme();
  const team = useTeamHook();
  if (room.kind === 'ozel') {
    const p = team.person(room.other_user);
    if (p) return <Avatar person={p} size={size} />;
  }
  const bg = room.kind === 'genel' ? 'a1' : 'a3';
  return (
    <Box
      bg={bg}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon
        name={room.kind === 'genel' ? 'sohbet' : 'proje'}
        size={size * 0.45}
        color={colors[`${bg}-ink`]}
        strokeWidth={2}
      />
    </Box>
  );
}
