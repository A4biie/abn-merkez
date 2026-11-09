import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field, Pill } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { friendlyError } from '@/lib/errors';
import { pickImage } from '@/lib/media';
import { createPoll, type PollDraftOption } from '@/lib/polls';
import { useTeam } from '@/lib/team';
import { useTheme } from '@/theme/ThemeProvider';

const ENDS: [string, number | null][] = [
  ['Bitiş yok', null],
  ['1 gün', 1],
  ['3 gün', 3],
  ['1 hafta', 7],
];

/** "Oylama" seçilince açılan form: soru, 2-6 seçenek (isteğe bağlı görselle) ve ayarlar. */
export function PollForm({
  question,
  onQuestion,
  projectId,
  onDone,
}: {
  question: string;
  onQuestion: (q: string) => void;
  projectId: string | null;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const say = useToast();
  const team = useTeam();
  const [options, setOptions] = useState<PollDraftOption[]>([
    { body: '', image: null },
    { body: '', image: null },
  ]);
  const [multiple, setMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [days, setDays] = useState<number | null>(null);
  const [showResults, setShowResults] = useState<'oy_verince' | 'bitince'>('oy_verince');
  const [busy, setBusy] = useState(false);

  const setOption = (i: number, patch: Partial<PollDraftOption>) =>
    setOptions((prev) => prev.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  async function addImage(i: number) {
    const image = await pickImage({ aspect: [1, 1] });
    if (image) setOption(i, { image });
  }

  async function submit() {
    if (!question.trim()) return say('Önce soruyu yaz');
    if (options.some((o) => !o.body.trim())) return say('Seçeneklerin hepsine bir metin yaz');
    setBusy(true);
    try {
      await createPoll({
        userId: team.meId,
        question,
        projectId,
        options,
        multiple,
        anonymous,
        endsAt: days ? new Date(Date.now() + days * 86_400_000) : null,
        showResults,
      });
      say('Oylama açıldı');
      onDone();
    } catch (e) {
      say(friendlyError(e, 'Oylama açılamadı. Biraz sonra tekrar dene.'));
    } finally {
      setBusy(false);
    }
  }

  const setting = (label: string, children: React.ReactNode) => (
    <View style={{ gap: 6 }}>
      <Txt size={12.5} color="muted">
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>
    </View>
  );

  return (
    <View style={{ gap: 12 }}>
      <Field
        label="Oylama sorusu"
        value={question}
        onChangeText={onQuestion}
        placeholder="Ne soruyorsun? Örn. Hangi logo?"
      />
      {options.map((o, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Press
            onPress={() => (o.image ? setOption(i, { image: null }) : addImage(i))}
            accessibilityLabel={
              o.image ? `${i + 1}. seçeneğin görselini kaldır` : `${i + 1}. seçeneğe görsel ekle`
            }
            bg="surface2"
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {o.image ? (
              <Image source={{ uri: o.image.uri }} style={{ width: 46, height: 46 }} contentFit="cover" />
            ) : (
              <Icon name="image" size={18} color={colors.muted} />
            )}
          </Press>
          <Field
            label={`${i + 1}. seçenek`}
            value={o.body}
            onChangeText={(body) => setOption(i, { body })}
            placeholder={`${i + 1}. seçenek`}
            style={{ flex: 1, minWidth: 0 }}
          />
          {options.length > 2 && (
            <Press
              onPress={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
              accessibilityLabel={`${i + 1}. seçeneği kaldır`}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="close" size={14} color={colors.muted} strokeWidth={2.2} />
            </Press>
          )}
        </View>
      ))}
      {options.length < 6 && (
        <Press
          onPress={() => setOptions((prev) => [...prev, { body: '', image: null }])}
          style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
        >
          <Txt size={14} weight={600} color="accent-text">
            + Seçenek ekle
          </Txt>
        </Press>
      )}
      {setting(
        'Seçim',
        <>
          <Pill label="Tek seçim" size="sm" onSheet active={!multiple} onPress={() => setMultiple(false)} />
          <Pill label="Çoklu seçim" size="sm" onSheet active={multiple} onPress={() => setMultiple(true)} />
        </>,
      )}
      {setting(
        'Oylar',
        <>
          <Pill label="İsimli" size="sm" onSheet active={!anonymous} onPress={() => setAnonymous(false)} />
          <Pill label="İsimsiz" size="sm" onSheet active={anonymous} onPress={() => setAnonymous(true)} />
        </>,
      )}
      {setting(
        'Sonuçlar',
        <>
          <Pill
            label="Oy verince görünsün"
            size="sm"
            onSheet
            active={showResults === 'oy_verince'}
            onPress={() => setShowResults('oy_verince')}
          />
          <Pill
            label="Oylama bitince görünsün"
            size="sm"
            onSheet
            active={showResults === 'bitince'}
            onPress={() => setShowResults('bitince')}
          />
        </>,
      )}
      {setting(
        'Bitiş',
        ENDS.map(([label, d]) => (
          <Pill key={label} label={label} size="sm" onSheet active={days === d} onPress={() => setDays(d)} />
        )),
      )}
      {anonymous && (
        <Txt size={13} color="muted">
          İsimsiz oylamada kimin neye oy verdiğini kimse göremez, yöneticiler de. Sadece toplamlar görünür.
        </Txt>
      )}
      <Button label={busy ? 'Açılıyor…' : 'Oylamayı aç'} size="lg" onPress={submit} disabled={busy} />
    </View>
  );
}
