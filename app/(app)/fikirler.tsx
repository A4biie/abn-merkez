import { useLocalSearchParams , router } from 'expo-router';
import { useRef, useState, type ComponentRef, useEffect } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { matches, useSearch } from '@/components/layout/Search';
import { useIsWide } from '@/components/layout/useIsWide';
import { HeartButton } from '@/components/Social';
import { Avatar } from '@/components/ui/Avatar';
import { Button, Card, Chip, Field, IconButton, Pill } from '@/components/ui/Controls';
import { ErrorState, SkeletonCards } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { friendlyError } from '@/lib/errors';
import { IDEA_STATUS } from '@/lib/labels';
import { addIdea, convertIdea, setIdeaStatus, toggleHeart, useIdeas } from '@/lib/queries';
import { likeInfo, useTeam } from '@/lib/team';
import type { Idea, IdeaStatus } from '@/lib/types';

const FILTERS: [IdeaStatus | 'tumu', string][] = [
  ['tumu', 'Tümü'],
  ['yeni', 'Yeni'],
  ['konusuluyor', 'Konuşuluyor'],
  ['gorev', 'Göreve dönüştü'],
  ['simdilik', 'Şimdilik değil'],
];

export default function Fikirler() {
  const wide = useIsWide();
  const say = useToast();
  const team = useTeam();
  const ideas = useIdeas();
  const { query } = useSearch();
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<IdeaStatus | 'tumu'>('tumu');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  // Ctrl+K > Yeni fikir: yazma kutusuna odaklan.
  const { yeni } = useLocalSearchParams<{ yeni?: string }>();
  useEffect(() => {
    if (yeni) setTimeout(() => inputRef.current?.focus(), 50);
  }, [yeni]);

  const list = (ideas.data ?? []).filter((i) => (filter === 'tumu' || i.status === filter) && matches(i.body, query));

  async function save() {
    const body = draft.trim();
    if (!body) {
      say('Fikrini yazmayı unuttun');
      return;
    }
    setSaving(true);
    const error = await addIdea(team.meId, body);
    setSaving(false);
    if (error) {
      say(friendlyError(error));
      return;
    }
    setDraft('');
    setFilter('tumu');
    say('Fikir deftere yazıldı');
  }

  const voiceSoon = () => say('Sesli not ve görsel ekleme bir sonraki sürümde geliyor');

  const composer = (
    <Card radius={24} padding={wide ? 16 : 14} gap={10} style={wide ? { flexDirection: 'row', alignItems: 'flex-start', gap: 12 } : undefined}>
      {!wide && (
        <Txt size={13} color="muted">
          Aklına bir şey mi geldi? Kaybolmadan yaz.
        </Txt>
      )}
      <Field
        ref={inputRef}
        label="Yeni fikir"
        value={draft}
        onChangeText={setDraft}
        multiline
        minHeight={wide ? 56 : 64}
        placeholder={wide ? 'Aklına bir şey mi geldi? Kaybolmadan yaz…' : 'Örn. ana menüde yağmur sesi olsun…'}
        style={wide ? { flex: 1 } : undefined}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <IconButton icon="mic" label="Sesli not" kind="muted" size={wide ? 46 : 44} onPress={voiceSoon} />
        <Button
          label={saving ? 'Kaydediliyor…' : 'Fikri kaydet'}
          onPress={save}
          disabled={saving}
          style={wide ? { height: 46, paddingHorizontal: 20 } : { flex: 1 }}
        />
      </View>
    </Card>
  );

  const filters = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {FILTERS.map(([key, label]) => (
        <Pill key={key} label={label} active={filter === key} onPress={() => setFilter(key)} />
      ))}
    </ScrollView>
  );

  const body = ideas.loading ? (
    <SkeletonCards count={3} lines={2} />
  ) : ideas.error ? (
    <ErrorState message={ideas.error} onRetry={ideas.refetch} />
  ) : list.length === 0 ? (
    filter === 'tumu' ? (
      <EmptyState title="Defter boş" description="Aklına gelen ilk fikri yaz, kaybolmasın." />
    ) : (
      <EmptyState title="Bu başlıkta fikir yok" description="Başka bir başlığa bak ya da yeni bir fikir yaz." />
    )
  ) : (
    <View style={wide ? { flexDirection: 'row', flexWrap: 'wrap', gap: 16 } : { gap: 16 }}>
      {list.map((i) => (
        <IdeaCard key={i.id} idea={i} wide={wide} />
      ))}
    </View>
  );

  return (
    <Screen
      onRefresh={ideas.refetch}
      title="Fikir Defteri"
      crumb="Kaybolmasın diye"
      search
      action={
        <Button label="Panolar" kind="cyan" icon="pano" onPress={() => router.navigate('/panolar')} />
      }
      wideAction={<Button label="Yeni fikir" kind="accent" icon="plus" onPress={() => inputRef.current?.focus()} />}
    >
      {composer}
      {filters}
      {body}
    </Screen>
  );
}

function IdeaCard({ idea, wide }: { idea: Idea; wide: boolean }) {
  const say = useToast();
  const team = useTeam();
  const st = IDEA_STATUS[idea.status];
  const author = team.person(idea.author_id);
  const likes = likeInfo(idea.hearts, team.meId, team.nameOf);
  const project = idea.project_id ? team.projectMap.get(idea.project_id)?.name : undefined;
  const canManage = team.isAdmin || idea.author_id === team.meId;
  const canConvert = canManage && idea.status !== 'gorev';
  const canShelve = canConvert && idea.status !== 'simdilik';

  async function convert() {
    const error = await convertIdea(idea, team.meId);
    say(error ? friendlyError(error) : 'Görev oluşturuldu, havuzda');
  }
  async function shelve() {
    const error = await setIdeaStatus(idea.id, 'simdilik');
    say(error ? friendlyError(error) : 'Rafa kalktı, silinmedi');
  }
  async function heart() {
    const error = await toggleHeart('idea', idea.id, team.meId, likes.liked);
    if (error) say(friendlyError(error));
  }

  const size = wide ? 'sm' : 'md';
  return (
    <Card radius={wide ? 22 : 24} padding={wide ? 18 : 16} gap={wide ? 12 : 10} style={wide ? { flexGrow: 1, flexBasis: 290, maxWidth: 460 } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt size={12.5} weight={600} color="accent-text" style={{ flex: 1 }}>
          {project ?? 'Yeni proje fikri'}
        </Txt>
        <Chip label={st.label} bg={st.bg} fg={st.fg} />
      </View>
      <Txt size={16} style={wide ? { flexGrow: 1 } : undefined}>
        {idea.body}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {author && <Avatar person={author} size={26} />}
        <Txt size={13} color="muted" style={{ flex: 1 }}>
          {author?.full_name ?? 'Biri'} · {likes.text || 'henüz kalp yok'}
        </Txt>
        <HeartButton liked={likes.liked} onPress={heart} size={wide ? 36 : 38} />
      </View>
      {canConvert && (
        <View style={{ flexDirection: 'row', gap: wide ? 6 : 8 }}>
          <Button label="Göreve dönüştür" kind="accent" size={size} onPress={convert} />
          {canShelve && <Button label="Şimdilik değil" kind="soft" size={size} onPress={shelve} />}
        </View>
      )}
    </Card>
  );
}
