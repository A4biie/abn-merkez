import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useActions } from '@/components/sheets/ActionsProvider';
import { Button, Card } from '@/components/ui/Controls';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { friendlyError } from '@/lib/errors';
import { answerNudge } from '@/lib/queries';
import { daysSince } from '@/lib/time';
import type { Post, Profile, Task } from '@/lib/types';

/** Bu kadar gün durumu değişmeyen görev için "Hâlâ sende mi?" sorulur. */
const STALE_DAYS = 14;
/** Bu kadar gündür paylaşım yoksa nazik bir hatırlatma çıkar. */
const QUIET_DAYS = 14;
/** "Şimdi değil" denince hatırlatma bu kadar gün susar. */
const SNOOZE_DAYS = 7;
const SNOOZE_KEY = 'abn.paylasimHatirlatma';

/** Kişinin kendi hareketsiz görevi (prototipteki staleTask). Moladaysa sorulmaz. */
export function staleTaskFor(me: Profile | null, tasks: Task[]) {
  if (!me || me.availability === 'ara') return undefined;
  return tasks
    .filter(
      (t) =>
        t.assignee_id === me.id &&
        (t.status === 'bende' || t.status === 'incelemede') &&
        daysSince(t.status_changed_at) >= STALE_DAYS,
    )
    .sort((a, b) => a.status_changed_at.localeCompare(b.status_changed_at))[0];
}

/** "Sadece sen görüyorsun · ... bir süredir hareketsiz. Hâlâ sende mi?" */
export function TaskNudge({ task, compact }: { task: Task; compact?: boolean }) {
  const say = useToast();
  const [done, setDone] = useState(false);
  if (done) return null;

  async function answer(kind: 'keep' | 'time' | 'drop') {
    setDone(true);
    const error = await answerNudge(task, kind);
    if (error) {
      setDone(false);
      say(friendlyError(error));
      return;
    }
    say(kind === 'drop' ? 'Havuza bırakıldı, sorun değil' : kind === 'time' ? 'Tamam, acelesi yok' : 'Süper, kolay gelsin');
  }

  const size = compact ? 'sm' : 'md';
  return (
    <Card radius={compact ? 22 : 24} padding={compact ? 16 : 18} gap={compact ? 10 : 12}>
      <Txt size={compact ? 12.5 : 13} color="muted">
        Sadece sen görüyorsun
      </Txt>
      <Txt size={compact ? 15 : 16} weight={600}>
        “{task.title}” bir süredir hareketsiz. Hâlâ sende mi?
      </Txt>
      <View style={{ flexDirection: 'row', gap: compact ? 6 : 8, flexWrap: 'wrap' }}>
        <Button label="Devam ediyorum" size={size} bold={false} onPress={() => answer('keep')} />
        <Button label={compact ? 'Vakit lazım' : 'Biraz vakit lazım'} size={size} kind="soft" onPress={() => answer('time')} />
        <Button label="Havuza bırak" size={size} kind="soft" onPress={() => answer('drop')} />
      </View>
    </Card>
  );
}

/**
 * Bir süredir paylaşım yapmayan kişiye nazik hatırlatma. Sadece o kişi görür, "Şimdi değil"
 * ile bir hafta susar, moladayken hiç çıkmaz. Prototipte yok; nudge kartının dilini taşır.
 */
export function ShareReminder({ me, posts, compact }: { me: Profile | null; posts: Post[]; compact?: boolean }) {
  const actions = useActions();
  // null: henüz okunmadı, true: ertelendi, false: gösterilebilir.
  const [snoozed, setSnoozed] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SNOOZE_KEY).then((v) => setSnoozed(!!v && Number(v) > Date.now()));
  }, []);

  if (!me || me.availability === 'ara' || snoozed !== false) return null;
  const last = posts.find((p) => p.author_id === me.id)?.created_at ?? me.created_at;
  if (daysSince(last) < QUIET_DAYS) return null;

  function snooze() {
    const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    setSnoozed(true);
    AsyncStorage.setItem(SNOOZE_KEY, String(until));
  }

  const size = compact ? 'sm' : 'md';
  return (
    <Card radius={compact ? 22 : 24} padding={compact ? 16 : 18} gap={compact ? 10 : 12}>
      <Txt size={compact ? 12.5 : 13} color="muted">
        Sadece sen görüyorsun
      </Txt>
      <Txt size={compact ? 15 : 16} weight={600}>
        Bir süredir paylaşım yapmadın. Yarım kalmış bir taslak bile ekibe iyi gelir.
      </Txt>
      <View style={{ flexDirection: 'row', gap: compact ? 6 : 8, flexWrap: 'wrap' }}>
        <Button label="Bir şey paylaş" size={size} bold={false} onPress={() => actions.openShare()} />
        <Button label="Şimdi değil" size={size} kind="soft" onPress={snooze} />
      </View>
    </Card>
  );
}
