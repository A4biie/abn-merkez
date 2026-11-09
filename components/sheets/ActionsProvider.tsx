import { router } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform, View } from 'react-native';

import { Box } from '@/components/ui/Box';
import { Button, Field, Pill } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Stagger } from '@/components/ui/Stagger';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { markFinished } from '@/lib/celebrate';
import { friendlyError } from '@/lib/errors';
import { addTask, advanceTask, claimTask, sendRequest, setNeedsHelp } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import type { ClaimResult, Task } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { ShareForm, type ShareDraft } from './ShareForm';

type Actions = {
  claim: (task: Task) => void;
  advance: (task: Task) => void;
  toggleHelp: (task: Task) => void;
  openShare: (draft?: ShareDraft) => void;
  openAddTask: (draft?: TaskDraft) => void;
};

export type TaskDraft = { title?: string; projectId?: string | null };

const ActionsContext = createContext<Actions | null>(null);

type Open =
  | { kind: 'lock'; task: Task; result: Extract<ClaimResult, { ok: false }> }
  | { kind: 'share'; draft?: ShareDraft }
  | { kind: 'add'; draft?: TaskDraft }
  | null;

/**
 * Görev ve paylaşım işlerinin ortak panelleri. Akış, Görevler ve proje detayı aynı
 * davranışı buradan alır (prototipteki claim / advance / sendRequest / askShare).
 */
export function ActionsProvider({ children }: { children: ReactNode }) {
  const say = useToast();
  const [open, setOpen] = useState<Open>(null);
  const close = useCallback(() => setOpen(null), []);

  const claim = useCallback(
    async (task: Task) => {
      try {
        const result = await claimTask(task.id);
        if (result.ok) say(result.message);
        else setOpen({ kind: 'lock', task, result });
      } catch (e) {
        say(friendlyError(e));
      }
    },
    [say],
  );

  const advance = useCallback(
    async (task: Task) => {
      const finishing = task.status === 'incelemede';
      // Bitiriliyorsa kutlama kartın üstünde oynar (lib/celebrate); telefonda başarı titreşimi.
      if (finishing) {
        markFinished(task.id);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      const error = await advanceTask(task);
      if (error) say(friendlyError(error));
      else if (!finishing) say('Durum güncellendi');
    },
    [say],
  );

  const toggleHelp = useCallback(
    async (task: Task) => {
      const error = await setNeedsHelp(task.id, !task.needs_help);
      if (error) say(friendlyError(error));
      else say(task.needs_help ? 'Çözüldü olarak işaretlendi' : 'Yöneticiye haber verildi, yalnız değilsin');
    },
    [say],
  );

  const value = useMemo<Actions>(
    () => ({
      claim,
      advance,
      toggleHelp,
      openShare: (draft) => setOpen({ kind: 'share', draft }),
      openAddTask: (draft) => setOpen({ kind: 'add', draft }),
    }),
    [claim, advance, toggleHelp],
  );

  return (
    <ActionsContext.Provider value={value}>
      {children}
      <Sheet open={!!open} onClose={close} label={sheetLabel(open)}>
        {open?.kind === 'lock' && <LockSheet task={open.task} result={open.result} onClose={close} />}
        {open?.kind === 'share' && (
          <ShareForm
            initial={open.draft}
            onDone={() => {
              close();
              router.navigate('/akis');
            }}
          />
        )}
        {open?.kind === 'add' && <AddTaskSheet initial={open.draft} onClose={close} />}
      </Sheet>
    </ActionsContext.Provider>
  );
}

function sheetLabel(open: Open) {
  switch (open?.kind) {
    case 'lock':
      return 'Görev kilitli';
    case 'share':
      return 'Süreç paylaş';
    case 'add':
      return 'Yeni görev';
    default:
      return '';
  }
}

export function useActions() {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error('useActions, ActionsProvider içinde kullanılmalı.');
  return ctx;
}

// ───────────────────────── Kilit ─────────────────────────

function LockSheet({
  task,
  result,
  onClose,
}: {
  task: Task;
  result: Extract<ClaimResult, { ok: false }>;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const say = useToast();
  const team = useTeam();
  const [sent, setSent] = useState(!!result.request_pending);

  async function request() {
    if (sent || !result.request_kind) return;
    const error = await sendRequest({
      userId: team.meId,
      kind: result.request_kind,
      projectId: result.project_id ?? task.project_id,
      taskId: task.id,
    });
    if (error) {
      say(friendlyError(error));
      return;
    }
    setSent(true);
    say(result.request_kind === 'proje' ? 'İstek proje yöneticisine gitti' : 'İstek gönderildi');
    onClose();
  }

  const label = sent
    ? 'İstek gönderildi'
    : result.request_kind === 'proje'
      ? 'Projeye katılmak istiyorum'
      : 'Bu görevi almak istiyorum';

  return (
    <Stagger gap={14}>
      <Box
        bg="surface2"
        style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="lock" size={24} color={colors['accent-text']} strokeWidth={2} />
      </Box>
      <Txt size={22} weight={700} leading={1.2}>
        {result.title}
      </Txt>
      <Txt color="text-3">{result.reason}</Txt>
      <Box bg="surface2" style={{ borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 }}>
        <Txt size={14}>
          <Txt size={14} color="muted">
            Görev:
          </Txt>{' '}
          {task.title}
        </Txt>
      </Box>
      <View style={{ gap: 8 }}>
        {result.request_kind && (
          <Button
            label={label}
            size="lg"
            kind={sent ? 'muted' : 'primary'}
            disabled={sent}
            onPress={request}
          />
        )}
        <Button label={result.request_kind ? 'Vazgeç' : 'Tamam'} size="lg" kind="soft" onPress={onClose} />
      </View>
    </Stagger>
  );
}

// ───────────────────────── Yeni görev ─────────────────────────

function AddTaskSheet({ initial, onClose }: { initial?: TaskDraft; onClose: () => void }) {
  const say = useToast();
  const team = useTeam();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [projectId, setProjectId] = useState<string | null>(initial?.projectId ?? null);
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);

  const myProjects = team.projects.filter((p) => team.isAdmin || p.members.includes(team.meId));

  async function submit() {
    const t = title.trim();
    if (!t) {
      say('Görevin bir adı olsun yeter');
      return;
    }
    setBusy(true);
    const error = await addTask({ title: t, projectId, mine, userId: team.meId });
    setBusy(false);
    if (error) {
      say(friendlyError(error));
      return;
    }
    say(mine ? 'Görev eklendi, sende' : 'Görev havuza eklendi');
    onClose();
    router.navigate({ pathname: '/gorevler', params: { sekme: mine ? 'bende' : 'havuz' } });
  }

  return (
    <View style={{ gap: 14 }}>
      <Txt size={22} weight={700} leading={1.2}>
        Yeni görev
      </Txt>
      <Field
        label="Görev adı"
        value={title}
        onChangeText={setTitle}
        placeholder="Ne yapılması lazım?"
        autoFocus
        onSubmitEditing={submit}
        style={{ fontSize: 16, paddingVertical: 14 }}
      />
      <Txt size={13} color="muted">
        Proje
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Pill label="Projesiz" onSheet active={projectId === null} onPress={() => setProjectId(null)} />
        {myProjects.map((p) => (
          <Pill
            key={p.id}
            label={p.name}
            onSheet
            active={projectId === p.id}
            onPress={() => setProjectId(p.id)}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pill label="Havuza koy" onSheet active={!mine} onPress={() => setMine(false)} style={{ flex: 1 }} />
        <Pill label="Ben yapacağım" onSheet active={mine} onPress={() => setMine(true)} style={{ flex: 1 }} />
      </View>
      <Txt size={13} color="muted">
        Sadece başlık yeterli. Tarih, not ve dosyayı sonra da ekleyebilirsin.
      </Txt>
      <Button label={busy ? 'Ekleniyor…' : 'Görevi ekle'} size="lg" onPress={submit} disabled={busy} />
    </View>
  );
}
