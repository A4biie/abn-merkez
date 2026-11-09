import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { matches, useSearch } from '@/components/layout/Search';
import { useIsWide } from '@/components/layout/useIsWide';
import { useActions } from '@/components/sheets/ActionsProvider';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Box } from '@/components/ui/Box';
import { EmptyState } from '@/components/EmptyState';
import { Empty, IconButton, Pill } from '@/components/ui/Controls';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { Txt } from '@/components/ui/Txt';
import { useJustFinished } from '@/lib/celebrate';
import { TASK_ORDER, TASK_STATUS } from '@/lib/labels';
import { useTasks } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import type { Task } from '@/lib/types';

type Scope = 'bende' | 'havuz' | 'tumu';

const HINTS: Record<Scope, string> = {
  bende: 'Kartın altındaki butonla durumu bir adım ilerlet. Takıldıysan söyle, yardım gelir.',
  havuz: 'Sahibini bekleyen görevler. Kilitli olanlar başka bir projenin ekibine ait.',
  tumu: 'Ekipteki tüm açık görevler.',
};

export default function Gorevler() {
  const wide = useIsWide();
  const params = useLocalSearchParams<{ sekme?: string }>();
  const initial: Scope = params.sekme === 'havuz' || params.sekme === 'tumu' ? params.sekme : 'bende';
  const [scope, setScope] = useState<Scope>(initial);
  const [seenParam, setSeenParam] = useState(params.sekme);
  // Akış'taki kutucuklardan gelince ilgili sekme açılsın.
  if (params.sekme !== seenParam) {
    setSeenParam(params.sekme);
    if (params.sekme === 'bende' || params.sekme === 'havuz' || params.sekme === 'tumu') setScope(params.sekme);
  }

  const team = useTeam();
  const actions = useActions();
  const tasks = useTasks();
  const { query } = useSearch();
  const justFinished = useJustFinished();
  const all = (tasks.data ?? []).filter((t) => matches(t.title, query));

  const lists: Record<Scope, Task[]> = {
    bende: all.filter((t) => t.assignee_id === team.meId && (t.status !== 'bitti' || justFinished.has(t.id))),
    havuz: all.filter((t) => t.status === 'havuz'),
    tumu: all.filter((t) => t.status !== 'bitti' || justFinished.has(t.id)),
  };

  if (wide) return <Kanban all={all} scope={scope} setScope={setScope} loading={tasks.loading} error={tasks.error} retry={tasks.refetch} />;

  const list = lists[scope];
  return (
    <Screen
      onRefresh={tasks.refetch}
      title="Görevler"
      action={<IconButton icon="plus" label="Görev ekle" size={48} onPress={() => actions.openAddTask()} />}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['bende', 'havuz', 'tumu'] as Scope[]).map((s) => (
          <Pill
            key={s}
            size="lg"
            label={s === 'bende' ? 'Bende' : s === 'havuz' ? 'Havuz' : 'Tümü'}
            active={scope === s}
            onPress={() => setScope(s)}
          />
        ))}
      </View>
      <Txt size={13.5} color="muted">
        {HINTS[scope]}
      </Txt>
      {tasks.loading ? (
        <SkeletonCards count={3} lines={2} />
      ) : tasks.error ? (
        <ErrorState message={tasks.error} onRetry={tasks.refetch} />
      ) : list.length === 0 ? (
        <TaskEmpty scope={scope} searching={!!query.trim()} onPool={() => setScope('havuz')} onAdd={() => actions.openAddTask()} />
      ) : (
        <View style={{ gap: 16 }}>
          {list.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </View>
      )}
    </Screen>
  );
}

/** Görev listesi boşken: kapsama ve aramaya göre metin. */
function TaskEmpty({
  scope,
  searching,
  onPool,
  onAdd,
}: {
  scope: Scope;
  searching: boolean;
  onPool: () => void;
  onAdd: () => void;
}) {
  if (searching) return <EmptyState title="Aramaya uyan görev yok" description="Başka bir kelimeyle dene." />;
  if (scope === 'bende')
    return (
      <EmptyState
        title="Üzerinde görev yok"
        description="Havuza bakıp ilgini çeken bir görevi alabilirsin."
        action={{ label: 'Havuza bak', onPress: onPool }}
      />
    );
  if (scope === 'havuz')
    return (
      <EmptyState
        title="Havuz şimdilik boş"
        description="Yeni görev düşünce burada görünecek. Acelesi yok."
        action={{ label: '+ Görev öner', onPress: onAdd }}
      />
    );
  return <EmptyState title="Açık görev yok" description="Hepsi bitmiş görünüyor. Eline sağlık." />;
}

/** Bilgisayar: kapsam sekmeleri, proje filtresi ve 4 sütunlu pano (Desktop.dc.html). */
function Kanban({
  all,
  scope,
  setScope,
  loading,
  error,
  retry,
}: {
  all: Task[];
  scope: Scope;
  setScope: (s: Scope) => void;
  loading: boolean;
  error?: string;
  retry: () => void;
}) {
  const team = useTeam();
  const [project, setProject] = useState<string>('');

  const scoped = {
    bende: all.filter((t) => t.assignee_id === team.meId),
    havuz: all.filter((t) => t.status === 'havuz'),
    tumu: all,
  };
  const visible = scoped[scope].filter((t) =>
    project === '' ? true : project === '_none' ? !t.project_id : t.project_id === project,
  );
  const filters: [string, string][] = [
    ['', 'Tüm projeler'],
    ...team.projects.map((p) => [p.id, p.name] as [string, string]),
    ['_none', 'Projesiz'],
  ];

  return (
    <Screen title="Görevler" crumb="Pano" search>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box bg="surface" shadow style={{ flexDirection: 'row', gap: 4, borderRadius: 999, padding: 4 }}>
          {(['bende', 'havuz', 'tumu'] as Scope[]).map((s) => (
            <Pill
              key={s}
              size="sm"
              onSheet
              label={s === 'bende' ? 'Bende' : s === 'havuz' ? 'Havuz' : 'Tümü'}
              suffix={String(scoped[s].length)}
              active={scope === s}
              onPress={() => setScope(s)}
              style={scope === s ? undefined : { backgroundColor: 'transparent' }}
            />
          ))}
        </Box>
        <Box bg="line-2" style={{ width: 1, height: 26 }} />
        {filters.map(([id, label]) => (
          <Pill key={id || 'all'} size="sm" onSheet label={label} active={project === id} onPress={() => setProject(id)} />
        ))}
        <View style={{ flex: 1 }} />
        <Txt size={13.5} color="muted">
          {HINTS[scope]}
        </Txt>
      </View>
      {loading ? (
        <SkeletonCards count={2} lines={2} />
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', gap: 16, minWidth: 1000, flex: 1 }}>
            {TASK_ORDER.map((status) => {
              const st = TASK_STATUS[status];
              const cards = visible.filter((t) => t.status === status);
              return (
                <Box key={status} bg="surface2" style={{ flex: 1, minWidth: 240, borderRadius: 22, padding: 12, gap: 10, minHeight: 320 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: st.dot }} />
                    <Txt weight={700} style={{ flex: 1 }}>
                      {st.label}
                    </Txt>
                    <Txt size={13} color="muted" style={{ fontVariant: ['tabular-nums'] }}>
                      {cards.length}
                    </Txt>
                  </View>
                  {cards.length === 0 && <Empty>Boş</Empty>}
                  {cards.map((t) => (
                    <TaskCard key={t.id} task={t} variant="kanban" />
                  ))}
                </Box>
              );
            })}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
