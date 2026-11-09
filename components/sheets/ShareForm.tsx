import { useState } from 'react';
import { View } from 'react-native';

import { PollForm } from '@/components/feed/PollForm';
import { Field, Pill } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Txt } from '@/components/ui/Txt';
import { friendlyError } from '@/lib/errors';
import { addPost } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import { useTheme } from '@/theme/ThemeProvider';

export type ShareDraft = { body?: string; projectId?: string | null; taskId?: string | null };

/**
 * "Süreç paylaş" formu. Telefonda panelde (Main.dc.html sheetShare), bilgisayarda Akış'ın
 * üstünde satır içi (Desktop.dc.html) kullanılır.
 */
export function ShareForm({
  initial,
  inline,
  onDone,
}: {
  initial?: ShareDraft;
  inline?: boolean;
  onDone?: () => void;
}) {
  const { colors } = useTheme();
  const say = useToast();
  const team = useTeam();
  const [body, setBody] = useState(initial?.body ?? '');
  const [projectId, setProjectId] = useState<string | null>(initial?.projectId ?? null);
  const [feedback, setFeedback] = useState(false);
  const [poll, setPoll] = useState(false);

  const myProjects = team.projects.filter((p) => team.isAdmin || p.members.includes(team.meId));
  const tags: [string | null, string][] = [
    [null, 'Genel'],
    ...myProjects.map((p) => [p.id, p.name] as [string, string]),
  ];

  /** SubmitButton için: hata metni ya da null. Başarıda buton "Paylaşıldı" der. */
  async function submit() {
    const text = body.trim();
    if (!text) return 'Önce birkaç kelime yaz.';
    const error = await addPost({
      userId: team.meId,
      body: text,
      type: feedback ? 'fikrinizi_istiyorum' : 'paylasim',
      projectId,
      taskId: initial?.taskId ?? null,
    });
    if (error) return friendlyError(error);
    setBody('');
    setFeedback(false);
    // Panel açıksa "Paylaşıldı" görünsün diye biraz bekleyip kapanır.
    if (onDone) setTimeout(onDone, 900);
    return null;
  }

  const mediaSoon = () => say('Görsel ve video ekleme bir sonraki sürümde geliyor');

  function pollDone() {
    setBody('');
    setPoll(false);
    onDone?.();
  }

  const pollToggle = (
    <Press
      onPress={() => setPoll((p) => !p)}
      bg={poll ? 'a3' : 'surface2'}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: poll }}
      style={{
        borderRadius: 999,
        paddingVertical: 7,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Icon name="oylama" size={15} color={poll ? colors['a3-ink'] : colors['text-2']} strokeWidth={2} />
      <Txt size={13.5} weight={600} color={poll ? 'a3-ink' : 'text-2'}>
        Oylama
      </Txt>
    </Press>
  );

  if (inline) {
    return (
      <View style={{ gap: 12 }}>
        {!poll && (
          <Field
            label="Paylaşım metni"
            value={body}
            onChangeText={setBody}
            placeholder="Ne üzerinde çalışıyorsun? Taslak, ekran görüntüsü, kısa bir not…"
            multiline
            minHeight={70}
            style={{ flex: 1 }}
          />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!poll && (
            <Press
              onPress={mediaSoon}
              hoverBg="hover"
              style={{
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: colors['line-2'],
                borderRadius: 999,
                paddingVertical: 7,
                paddingHorizontal: 12,
              }}
            >
              <Txt size={13.5} weight={600} color="muted">
                + Görsel / video
              </Txt>
            </Press>
          )}
          {tags.map(([id, label]) => (
            <Pill
              key={label}
              label={label}
              size="sm"
              onSheet
              active={projectId === id}
              onPress={() => setProjectId(id)}
            />
          ))}
          {!poll && (
            <Press
              onPress={() => setFeedback((f) => !f)}
              bg={feedback ? 'a2' : 'surface2'}
              accessibilityState={{ checked: feedback }}
              style={{ borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 }}
            >
              <Txt size={13.5} weight={600} color={feedback ? 'a2-ink' : 'text-2'}>
                Fikrinizi istiyorum
              </Txt>
            </Press>
          )}
          {pollToggle}
          <View style={{ flex: 1 }} />
          {!poll && <SubmitButton label="Paylaş" doneLabel="Paylaşıldı" onSubmit={submit} />}
        </View>
        {poll && <PollForm question={body} onQuestion={setBody} projectId={projectId} onDone={pollDone} />}
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt size={22} weight={700} leading={1.2} style={{ flex: 1 }}>
          {poll ? 'Oylama aç' : 'Süreç paylaş'}
        </Txt>
        {pollToggle}
      </View>
      {poll ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {tags.map(([id, label]) => (
              <Pill
                key={label}
                label={label}
                size="sm"
                onSheet
                active={projectId === id}
                onPress={() => setProjectId(id)}
              />
            ))}
          </View>
          <PollForm question={body} onQuestion={setBody} projectId={projectId} onDone={pollDone} />
        </>
      ) : (
        <>
          <Field
            label="Paylaşım metni"
            value={body}
            onChangeText={setBody}
            placeholder="Ne üzerinde çalışıyorsun?"
            multiline
            minHeight={84}
            autoFocus
          />
          <Press
            onPress={mediaSoon}
            style={{
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors['line-2'],
              borderRadius: 16,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Txt size={14} weight={600} color="muted">
              + Görsel ya da video ekle
            </Txt>
          </Press>
          <Txt size={13} color="muted">
            Etiket
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {tags.map(([id, label]) => (
              <Pill
                key={label}
                label={label}
                onSheet
                active={projectId === id}
                onPress={() => setProjectId(id)}
              />
            ))}
          </View>
          <Press
            onPress={() => setFeedback((f) => !f)}
            bg="surface2"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: feedback }}
            style={{
              borderRadius: 16,
              paddingVertical: 12,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                borderWidth: 2,
                borderColor: colors.a2,
                backgroundColor: feedback ? colors.a2 : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {feedback && <Icon name="check" size={14} color={colors['a2-ink']} strokeWidth={3} />}
            </View>
            <Txt size={14.5} weight={600} style={{ flex: 1 }}>
              Fikrinizi istiyorum (yorumlar öne çıkar)
            </Txt>
          </Press>
          <SubmitButton label="Paylaş" doneLabel="Paylaşıldı" size="lg" block onSubmit={submit} />
        </>
      )}
    </View>
  );
}
