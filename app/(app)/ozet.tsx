import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { useIsWide } from '@/components/layout/useIsWide';
import { Box } from '@/components/ui/Box';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';
import { useTasks } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import { thisWeek } from '@/lib/time';
import type { Task } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Haftalık özet (Main.dc.html "Bu hafta ekipte"). Kim ne kadar yaptı diye sıralama yok;
 * sadece bitenler, yardım bekleyenler ve havuzdakiler.
 */
export default function Ozet() {
  const { colors } = useTheme();
  const team = useTeam();
  const tasks = useTasks();
  const week = thisWeek();
  const wide = useIsWide();

  const all = tasks.data ?? [];
  const done = all.filter((t) => t.status === 'bitti' && new Date(t.status_changed_at) >= week.start);
  const blocked = all.filter((t) => t.status !== 'bitti' && t.needs_help);
  const pool = all.filter((t) => t.status === 'havuz');

  const who = (t: Task) => (t.assignee_id === team.meId ? 'Sende' : team.nameOf(t.assignee_id));
  const proj = (t: Task) => (t.project_id ? team.projectMap.get(t.project_id)?.name ?? '' : 'Projesiz');

  const block = (title: string, bg: 'a1' | 'a2' | 'a3', rows: string[], empty: string, check?: boolean) => (
    <Box bg={bg} style={{ borderRadius: 24, padding: 18, gap: 8 }}>
      <Txt size={17} weight={700} color={`${bg}-ink`}>
        {title}
      </Txt>
      {rows.length === 0 && (
        <Txt size={14.5} color={`${bg}-ink`}>
          {empty}
        </Txt>
      )}
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          {check && (
            <View style={{ marginTop: 3 }}>
              <Icon name="check" size={16} color={colors[`${bg}-ink`]} strokeWidth={2.6} />
            </View>
          )}
          <Txt size={14.5} color={`${bg}-ink`} style={{ flex: 1 }}>
            {r}
          </Txt>
        </View>
      ))}
    </Box>
  );

  return (
    <Screen title="Bu hafta ekipte" crumb={week.label} back>
      {/* Bilgisayarda tarih başlık şeridinde zaten yazıyor. */}
      {!wide && (
        <Txt size={13} color="muted" style={{ marginTop: -10 }}>
          {week.label}
        </Txt>
      )}
      {tasks.loading ? (
        <SkeletonCards count={3} lines={2} />
      ) : tasks.error ? (
        <ErrorState message={tasks.error} onRetry={tasks.refetch} />
      ) : (
        <View style={{ gap: 16, maxWidth: 720 }}>
          {block('Bitenler', 'a1', done.map((t) => `${t.title} · ${who(t)}`), 'Bu hafta henüz biten yok, olsun.', true)}
          {block('Yardım bekleyenler', 'a2', blocked.map((t) => `${t.title} · ${who(t)}`), 'Bu hafta kimse takılmadı.')}
          {block('Havuzda sahibini bekleyenler', 'a3', pool.map((t) => `${t.title} · ${proj(t)}`), 'Havuz boş.')}
          <Txt size={14} color="muted">
            Emeği geçen herkese teşekkürler. Gelecek hafta görüşürüz.
          </Txt>
        </View>
      )}
    </Screen>
  );
}
