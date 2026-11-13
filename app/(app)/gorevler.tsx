import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { matches, useSearch } from '@/components/layout/Search';
import { useIsWide } from '@/components/layout/useIsWide';
import { useActions } from '@/components/sheets/ActionsProvider';
import { KanbanBoard, nextLand } from '@/components/tasks/KanbanBoard';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskList } from '@/components/tasks/TaskList';
import { Box } from '@/components/ui/Box';
import { EmptyState } from '@/components/EmptyState';
import { IconButton, Pill } from '@/components/ui/Controls';
import { Press } from '@/components/ui/Press';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { Txt } from '@/components/ui/Txt';
import { useJustFinished } from '@/lib/celebrate';
import { useTasks } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import type { Task } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';

type Mode = 'kanban' | 'liste';
const MODE_KEY = 'abn.gorevler.gorunum';
function readMode(): Mode {
  try {
    return (globalThis.localStorage?.getItem(MODE_KEY) as Mode) === 'liste' ? 'liste' : 'kanban';
  } catch {
    return 'kanban';
  }
}

/** Kanban / Liste geçişi (seçim hatırlanır). */
function ModeSwitch({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: colors.surface }}>
      {(['kanban', 'liste'] as Mode[]).map((m) => (
        <Press
          key={m}
          onPress={() => setMode(m)}
          accessibilityState={{ selected: mode === m }}
          style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: mode === m ? colors.chip : undefined }}
        >
          <Txt size={12.5} weight={800} color={mode === m ? undefined : 'muted'}>
            {m === 'kanban' ? 'Kanban' : 'Liste'}
          </Txt>
        </Press>
      ))}
    </View>
  );
}

type Scope = 'bende' | 'havuz' | 'tumu';

const HINTS: Record<Scope, string> = {
  bende: 'Kartın altındaki butonla durumu bir adım ilerlet. Takıldıysan söyle, yardım gelir.',
  havuz: 'Sahibini bekleyen görevler. Kilitli olanlar başka bir projenin ekibine ait.',
  tumu: 'Ekipteki tüm açık görevler.',
};

export default function Gorevler() {
  const wide = useIsWide();
  const params = useLocalSearchParams<{ sekme?: string; vurgu?: string }>();
  const [mode, setModeState] = useState<Mode>(readMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      globalThis.localStorage?.setItem(MODE_KEY, m);
    } catch {}
  };
  // Ctrl+K'dan bir görev seçilince: Tümü + Kanban, kart yaylanır ve görünür olur.
  const [land, setLand] = useState<{ id: string; n: number } | null>(null);
  const [seenVurgu, setSeenVurgu] = useState<string | undefined>(undefined);
  if (params.vurgu && params.vurgu !== seenVurgu) {
    setSeenVurgu(params.vurgu);
    setLand({ id: params.vurgu, n: nextLand() });
    if (mode !== 'kanban') setModeState('kanban');
  }
  useEffect(() => {
    if (!land || Platform.OS !== 'web') return;
    const t = setTimeout(() => document.querySelector('[data-kcard="' + land.id + '"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }), 60);
    return () => clearTimeout(t);
  }, [land]);
  const initial: Scope = params.sekme === 'havuz' || params.sekme === 'tumu' ? params.sekme : 'bende';
  const [scope, setScope] = useState<Scope>(initial);
  const [seenParam, setSeenParam] = useState(params.sekme);
  // Akış'taki kutucuklardan gelince ilgili sekme açılsın.
  if (params.vurgu && params.vurgu !== seenVurgu && scope !== 'tumu') setScope('tumu');
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

  if (wide)
    return (
      <Kanban all={all} scope={scope} setScope={setScope} loading={tasks.loading} error={tasks.error} retry={tasks.refetch} mode={mode} setMode={setMode} land={land} />
    );

  const list = lists[scope];
  return (
    <Screen
      onRefresh={tasks.refetch}
      title="Görevler"
      action={<IconButton icon="plus" label="Görev ekle" size={48} onPress={() => actions.openAddTask()} />}
    >
      <ModeSwitch mode={mode} setMode={setMode} />
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
      ) : mode === 'kanban' ? (
        <KanbanBoard tasks={all} land={land} phone />
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
  mode,
  setMode,
  land,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  land: { id: string; n: number } | null;
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
        <ModeSwitch mode={mode} setMode={setMode} />
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
        mode === 'kanban' ? (
          <KanbanBoard tasks={visible} land={land} />
        ) : (
          <TaskList tasks={visible} />
        )
      )}
    </Screen>
  );
}
