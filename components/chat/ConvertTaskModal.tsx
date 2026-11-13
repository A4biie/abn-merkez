// "Mesajı göreve çevir" penceresi (0.11 bölüm 3, design/abn-09.html: taskForm + .modal .quote).
// Başlık mesajdan dolar; kişi (varsayılan: mesajı yazan), sütun, proje ve son tarih seçilir.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { closeConvertTask, createTaskFromMessage, dueOption, guessTitle, useConvertTask } from '@/lib/convert';
import { TASK_ORDER, TASK_STATUS } from '@/lib/labels';
import { useTeam } from '@/lib/team';
import type { TaskStatus } from '@/lib/types';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

const SPRING = 'cubic-bezier(0.2, 1.25, 0.35, 1)';
const mIn = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.97 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});
const fadeIn = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

type Opt = { value: string; label: string };

/** Webde açılır liste, telefonda seçenek çipleri. */
export function Choice({ value, options, onChange, label }: { value: string; options: Opt[]; onChange: (v: string) => void; label: string }) {
  const { colors } = useTheme();
  if (Platform.OS === 'web')
    return (
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '9px 11px',
          borderRadius: 10,
          background: colors.surface2,
          border: `1px solid ${colors.line}`,
          color: colors.text,
          fontFamily: 'Urbanist',
          fontSize: 14,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => (
        <Press
          key={o.value}
          onPress={() => onChange(o.value)}
          style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: o.value === value ? colors.a1 : colors.surface2 }}
        >
          <Txt size={12.5} weight={800} color={o.value === value ? 'a1-ink' : undefined}>
            {o.label}
          </Txt>
        </Press>
      ))}
    </View>
  );
}

export function Lab({ children }: { children: string }) {
  return (
    <Txt size={11} weight={800} color="muted" style={{ letterSpacing: 0.88, textTransform: 'uppercase' }}>
      {children}
    </Txt>
  );
}

export function ConvertTaskModal() {
  const cur = useConvertTask();
  if (!cur) return null;
  return <Form key={cur.message.id} message={cur.message} projectId={cur.projectId} />;
}

function Form({ message, projectId }: { message: NonNullable<ReturnType<typeof useConvertTask>>['message']; projectId: string | null }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const team = useTeam();
  const say = useToast();
  const [title, setTitle] = useState(() => guessTitle(message.body));
  const [who, setWho] = useState<string>(message.author_id ?? team.meId);
  const [col, setCol] = useState<TaskStatus>('havuz');
  const [proj, setProj] = useState<string>(projectId ?? '');
  const [due, setDue] = useState<'bugun' | 'yarin' | 'cuma' | 'yok'>('yarin');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeConvertTask();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, []);

  const save = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    const d = dueOption(due);
    try {
      // Kişi seçildiyse "Yapılacak" (havuz) yerine "Yapılıyor"a düşer: havuzdaki görevin sahibi olmaz.
      const status: TaskStatus = who && col === 'havuz' ? 'bende' : col;
      const id = await createTaskFromMessage({
        message,
        title: t,
        assignee: who || null,
        status,
        projectId: proj || null,
        dueLabel: d.label,
        dueDate: d.date,
      });
      closeConvertTask();
      say('Görev oluşturuldu');
      void id;
    } catch (e) {
      say((e as { message?: string }).message ?? 'Görev oluşturulamadı');
      setBusy(false);
    }
  };

  const people: Opt[] = [
    ...[...team.people.values()].map((p) => ({ value: p.id, label: p.full_name || '@' + p.username })),
    { value: '', label: 'Kimse (havuza)' },
  ];
  const author = team.person(message.author_id);
  const field = {
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: 14,
    fontFamily: 'Urbanist',
    outlineStyle: 'none',
  } as object;

  return (
    <Animated.View
      style={[
        {
          position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute',
          inset: 0,
          zIndex: 1050,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          backgroundColor: 'rgba(0,0,0,0.55)',
          animationName: fadeIn,
          animationDuration: 180,
          animationFillMode: 'both',
        },
        Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as object) : null,
      ]}
    >
      <Press onPress={closeConvertTask} accessibilityLabel="Kapat" pressScale={1} style={{ position: 'absolute', inset: 0 } as object} />
      <Animated.View
        role="dialog"
        aria-label="Mesajı göreve çevir"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90%',
          borderRadius: 18,
          backgroundColor: colors.surface,
          boxShadow: `0 0 0 1px ${colors.line}, 0 24px 60px rgba(0,0,0,.45)`,
          animationName: motion.reduced ? fadeIn : mIn,
          animationDuration: motion.reduced ? 150 : 260,
          animationTimingFunction: SPRING,
          animationFillMode: 'both',
        }}
      >
        <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
          <Txt size={18} weight={800}>
            Mesajı göreve çevir
          </Txt>
          <View
            style={{
              borderLeftWidth: 3,
              borderLeftColor: colors.a1,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderTopRightRadius: 8,
              borderBottomRightRadius: 8,
              backgroundColor: colors.surface2,
            }}
          >
            <Txt size={13} color="text-2" numberOfLines={4}>
              <Txt size={13} weight={800}>
                {(author?.full_name ?? 'Eski üye') + ': '}
              </Txt>
              {message.body}
            </Txt>
          </View>
          <View style={{ gap: 6 }}>
            <Lab>Başlık</Lab>
            <TextInput autoFocus selectTextOnFocus value={title} onChangeText={setTitle} onSubmitEditing={save} maxLength={200} style={field} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <View style={{ gap: 6, flex: 1, minWidth: 180 }}>
              <Lab>Kime</Lab>
              <Choice label="Kime" value={who} options={people} onChange={setWho} />
            </View>
            <View style={{ gap: 6, flex: 1, minWidth: 180 }}>
              <Lab>Sütun</Lab>
              <Choice
                label="Sütun"
                value={col}
                options={TASK_ORDER.map((s) => ({ value: s, label: TASK_STATUS[s].label }))}
                onChange={(v) => setCol(v as TaskStatus)}
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <View style={{ gap: 6, flex: 1, minWidth: 180 }}>
              <Lab>Proje</Lab>
              <Choice
                label="Proje"
                value={proj}
                options={[{ value: '', label: 'Projesiz' }, ...team.projects.map((p) => ({ value: p.id, label: p.name }))]}
                onChange={setProj}
              />
            </View>
            <View style={{ gap: 6, flex: 1, minWidth: 180 }}>
              <Lab>Son tarih</Lab>
              <Choice
                label="Son tarih"
                value={due}
                options={[
                  { value: 'bugun', label: 'Bugün' },
                  { value: 'yarin', label: 'Yarın' },
                  { value: 'cuma', label: 'Cuma' },
                  { value: 'yok', label: 'Yok' },
                ]}
                onChange={(v) => setDue(v as typeof due)}
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Txt size={12} color="muted" style={{ marginRight: 'auto' }}>
              Mesajın altına görev bağlantısı eklenir
            </Txt>
            <Press onPress={closeConvertTask} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.chip }}>
              <Txt size={13} weight={800}>
                Vazgeç
              </Txt>
            </Press>
            <Press
              onPress={save}
              bg="a2"
              gradient="btn"
              style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, opacity: busy ? 0.6 : 1 }}
            >
              <Txt size={13} weight={800} color="a2-ink">
                {busy ? 'Oluşturuluyor…' : 'Görev oluştur'}
              </Txt>
            </Press>
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

/** Çipten göreve git (Kanban'da kart yaylanır). */
export function goTask(id: string) {
  router.navigate({ pathname: '/gorevler', params: { sekme: 'tumu', vurgu: id } });
}
