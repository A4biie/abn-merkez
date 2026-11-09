import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsWide } from '@/components/layout/useIsWide';
import { LogoBadge } from '@/components/Logo';
import { LogoDraw } from '@/components/LogoDraw';
import { AvatarStack } from '@/components/Social';
import { Confetti } from '@/components/tasks/DoneCelebration';
import { ThemeList } from '@/components/ThemePicker';
import { Avatar } from '@/components/ui/Avatar';
import { Box } from '@/components/ui/Box';
import { Button, Field, Pill } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Press } from '@/components/ui/Press';
import { Select, Switch } from '@/components/ui/Select';
import { Stagger } from '@/components/ui/Stagger';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import { AVAILABILITY } from '@/lib/labels';
import { pickImage } from '@/lib/media';
import { sendRequest, uploadProfileImage, type PickedImage } from '@/lib/queries';
import { useTeam } from '@/lib/team';
import type { Availability } from '@/lib/types';
import { APP_VERSION } from '@/lib/version';
import { useTheme } from '@/theme/ThemeProvider';

import { TOUR_SKIPPED_KEY } from '@/lib/tour';

const SKILLS = [
  'Yazar',
  'Çizer',
  'Programcı',
  'Ses ve müzik',
  'Video',
  'Tasarım',
  'Seslendirme',
  'Sosyal medya',
];
const BIO_MAX = 160;
const STEPS = 5;
const AVAIL_NOTES: Record<Availability, string> = {
  musait: 'Görev alabilirim, haberler gelsin.',
  yogun: 'Ara ara bakarım; acil işleri başkası alsın.',
  ara: 'Şimdilik uzaktayım. Görev atanmaz, bildirim gelmez.',
};
const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${String(h).padStart(2, '0')}:00`,
}));

/**
 * İlk giriş akışı (0.7.0). Profili tamamlanmamış kişi (onboarded = false) açılıştan sonra buraya gelir.
 * 1 Hoş geldin · 2 Seni tanıyalım · 3 Vaktin · 4 Tema · 5 Projeler · 6 Hazırsın.
 * Hiçbir alan zorunlu değil; "Atla" ile her an çıkılır.
 */
export default function Hosgeldin() {
  const { profile, updateProfile } = useAuth();
  const team = useTeam();
  const wide = useIsWide();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [avatar, setAvatar] = useState<PickedImage | null>(null);
  const [skills, setSkills] = useState<string[]>(profile?.skills ?? []);
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avail, setAvail] = useState<Availability>(profile?.availability ?? 'musait');
  const [quiet, setQuiet] = useState(!profile?.onboarded || profile.quiet_start !== null);
  const [quietStart, setQuietStart] = useState(String(profile?.quiet_start ?? 23));
  const [quietEnd, setQuietEnd] = useState(String(profile?.quiet_end ?? 9));
  const [join, setJoin] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = (profile?.full_name ?? '').split(' ')[0] || 'merhaba';

  async function skip() {
    const firstTime = !profile?.onboarded;
    await updateProfile({ onboarded: true });
    if (firstTime) await AsyncStorage.setItem(TOUR_SKIPPED_KEY, '1').catch(() => {});
    await AsyncStorage.setItem('abn.seenVersion', APP_VERSION).catch(() => {});
    router.replace('/akis');
  }

  async function finish() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const avatar_url = avatar
        ? await uploadProfileImage('avatars', profile.id, avatar)
        : profile.avatar_url;
      const err = await updateProfile({
        avatar_url,
        skills,
        bio: bio.trim(),
        availability: avail,
        availability_until: null,
        quiet_start: quiet ? Number(quietStart) : null,
        quiet_end: quiet ? Number(quietEnd) : null,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul',
        onboarded: true,
      });
      if (err) throw new Error(err);
      for (const projectId of join) {
        const e = await sendRequest({ userId: profile.id, kind: 'proje', projectId });
        if (e) throw e;
      }
      // Yeni gelen biri için "Neler yeni" paneli gereksiz.
      await AsyncStorage.setItem('abn.seenVersion', APP_VERSION).catch(() => {});
      setStep(5);
    } catch (e) {
      setError(friendlyError(e, 'Kaydedilemedi. Biraz sonra tekrar dene.'));
    } finally {
      setBusy(false);
    }
  }

  const next = () => (step === 4 ? finish() : setStep((s) => s + 1));
  const primary = ['Başlayalım', 'Devam', 'Devam', 'Devam', busy ? 'Kaydediliyor…' : 'Bitir'][step];

  let body: ReactNode = null;
  if (step === 0) {
    body = (
      <>
        <LogoDraw size={84} />
        <Txt size={30} weight={800} leading={1.15}>
          Hoş geldin, {firstName}
        </Txt>
        <Txt size={16} color="text-3">
          ABN Merkez, ekibin projelerini, fikirlerini ve panolarını bir arada tuttuğu yer.
        </Txt>
        <Box bg="surface" style={{ borderRadius: 22, padding: 16, gap: 12 }}>
          {[
            ['clock', 'Saat sayan yok. Ne zaman vaktin olursa.'],
            ['gorev', 'Görevini sen seçersin. Takılırsan haber verirsin.'],
            ['bell', 'Hatırlatmalar nazik. Hepsini kapatabilir, sessiz saat koyabilirsin.'],
          ].map(([icon, text]) => (
            <View key={text} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Box
                bg="a2"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconFor name={icon} />
              </Box>
              <Txt size={15} style={{ flex: 1, paddingTop: 4 }}>
                {text}
              </Txt>
            </View>
          ))}
        </Box>
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <Title text="Seni tanıyalım" sub="Hiçbiri zorunlu değil; sonra profilinden de değiştirebilirsin." />
        <Press
          onPress={async () => {
            const img = await pickImage({ aspect: [1, 1] });
            if (img) setAvatar(img);
          }}
          accessibilityLabel="Profil fotoğrafı seç"
          style={{ alignSelf: 'center', alignItems: 'center', gap: 8 }}
        >
          {avatar ? (
            <Image
              source={{ uri: avatar.uri }}
              style={{ width: 96, height: 96, borderRadius: 48 }}
              contentFit="cover"
            />
          ) : profile ? (
            <Avatar person={profile} size={96} />
          ) : null}
          <Txt size={13.5} weight={700} color="accent-text">
            {avatar || profile?.avatar_url ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}
          </Txt>
        </Press>
        <Txt weight={700}>Ne yaparsın?</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SKILLS.map((s) => (
            <Pill
              key={s}
              label={s}
              onSheet
              active={skills.includes(s)}
              onPress={() =>
                setSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
              }
            />
          ))}
        </View>
        <Txt weight={700}>Kendinden bir cümle</Txt>
        <Field
          label="Kendinden bir cümle"
          value={bio}
          onChangeText={(v) => setBio(v.slice(0, BIO_MAX))}
          placeholder="Örn. Karakter çizmeyi ve iyi hikâyeleri severim."
          multiline
          minHeight={80}
        />
        <Txt size={12.5} color="faint" style={{ alignSelf: 'flex-end' }}>
          {bio.length} / {BIO_MAX}
        </Txt>
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        <Title text="Bu aralar vaktin nasıl?" sub="İstediğin zaman değiştirebilirsin." />
        {(Object.keys(AVAILABILITY) as Availability[]).map((a) => {
          const active = avail === a;
          return (
            <Press
              key={a}
              onPress={() => setAvail(a)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              bg={active ? 'surface' : 'surface2'}
              style={{
                borderRadius: 20,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                borderWidth: 2,
                borderColor: active ? AVAILABILITY[a].color : 'transparent',
              }}
            >
              <View
                style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: AVAILABILITY[a].color }}
              />
              <View style={{ flex: 1 }}>
                <Txt size={17} weight={700}>
                  {AVAILABILITY[a].label}
                </Txt>
                <Txt size={13.5} color="muted">
                  {AVAIL_NOTES[a]}
                </Txt>
              </View>
            </Press>
          );
        })}
        <Box bg="surface" style={{ borderRadius: 20, padding: 16, gap: 12, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Txt weight={700}>Sessiz saatler</Txt>
              <Txt size={13} color="muted">
                Bu saatlerde sohbet bildirimleri telefonuna gelmez, uygulamada birikir.
              </Txt>
            </View>
            <Switch label="Sessiz saatler" value={quiet} onChange={setQuiet} />
          </View>
          {quiet && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Select
                label="Sessiz saat başlangıcı"
                value={quietStart}
                options={HOURS}
                onChange={setQuietStart}
                minWidth={110}
              />
              <Txt color="muted">ile</Txt>
              <Select
                label="Sessiz saat bitişi"
                value={quietEnd}
                options={HOURS}
                onChange={setQuietEnd}
                minWidth={110}
              />
              <Txt color="muted">arası</Txt>
            </View>
          )}
        </Box>
      </>
    );
  } else if (step === 3) {
    body = (
      <>
        <Title text="Gözüne hangisi iyi geliyor?" sub="Seçtiğin tema hemen uygulanır." />
        <ThemeList title={false} />
      </>
    );
  } else if (step === 4) {
    body = (
      <>
        <Title text="Nelere göz atmak istersin?" sub="Katılmak istediklerini işaretle." />
        {team.projects.length === 0 && (
          <Txt color="muted">
            Şimdilik açık proje yok. Bir proje açılınca Projeler&apos;den katılabilirsin.
          </Txt>
        )}
        {team.projects.map((p) => {
          const member = p.members.includes(team.meId);
          const lead = team.person(p.lead_id);
          const people = p.members.map((id) => team.person(id)).filter((x) => !!x);
          const on = join.includes(p.id);
          return (
            <Box key={p.id} bg="surface" style={{ borderRadius: 20, padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={17} weight={700} numberOfLines={2}>
                    {p.name}
                  </Txt>
                  {!!p.summary && (
                    <Txt size={13.5} color="muted" numberOfLines={3}>
                      {p.summary}
                    </Txt>
                  )}
                </View>
                {member ? (
                  <Box bg="surface2" style={{ borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 }}>
                    <Txt size={12} weight={700} color="text-3">
                      Zaten ekiptesin
                    </Txt>
                  </Box>
                ) : (
                  <Switch
                    label={`${p.name} projesine katılmak istiyorum`}
                    value={on}
                    onChange={(v) =>
                      setJoin((prev) => (v ? [...prev, p.id] : prev.filter((x) => x !== p.id)))
                    }
                  />
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {people.length > 0 && <AvatarStack people={people} size={26} max={5} />}
                <Txt size={13} color="muted" numberOfLines={1} style={{ flex: 1 }}>
                  {lead ? `Lider: ${lead.full_name}` : 'Lider seçilmedi'}
                  {!member ? (on ? ' · Katılmak istiyorum' : '') : ''}
                </Txt>
              </View>
            </Box>
          );
        })}
        <Txt size={13} color="muted">
          İstek proje liderine gider. Acelesi yok.
        </Txt>
        {!!error && (
          <Txt size={14} color="warn-text" role="alert">
            {error}
          </Txt>
        )}
      </>
    );
  } else {
    body = (
      <View style={{ alignItems: 'center', gap: 14, paddingTop: 24 }}>
        <Confetti />
        <LogoBadge size={84} />
        <Txt size={30} weight={800}>
          Hazırsın!
        </Txt>
        <Txt size={16} color="text-3" style={{ textAlign: 'center', maxWidth: 340 }}>
          İlk iş olarak Havuz&apos;a göz atabilir ya da ekibe merhaba diyebilirsin.
        </Txt>
        <View style={{ width: '100%', gap: 10, marginTop: 10 }}>
          <Button
            label="Havuza bak"
            size="lg"
            onPress={() => router.replace({ pathname: '/gorevler', params: { sekme: 'havuz' } })}
          />
          <Button label="Akışa geç" size="lg" kind="soft" onPress={() => router.replace('/akis')} />
        </View>
      </View>
    );
  }

  return (
    <Box bg="bg" style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            paddingTop: 16 + insets.top,
            paddingHorizontal: 20,
            width: '100%',
            maxWidth: wide ? 560 : undefined,
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <View
            style={{ flex: 1, flexDirection: 'row', gap: 6 }}
            accessibilityLabel={`Adım ${Math.min(step + 1, STEPS)} / ${STEPS}`}
          >
            {Array.from({ length: STEPS }, (_, i) => (
              <Box
                key={i}
                bg={i <= step ? 'a1' : 'surface2'}
                style={{ flex: 1, height: 4, borderRadius: 2 }}
              />
            ))}
          </View>
          {step < 5 && (
            <Press
              onPress={skip}
              accessibilityLabel="Turu atla"
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
            >
              <Txt weight={700} color="muted">
                Atla
              </Txt>
            </Press>
          )}
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 32,
            width: '100%',
            maxWidth: wide ? 560 : undefined,
            alignSelf: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Her adımın içeriği sağdan, 50 ms arayla girer. */}
          <Stagger key={step} kind="push" gap={16}>
            {body}
          </Stagger>
        </ScrollView>

        {step < 5 && (
          <View
            style={{
              paddingHorizontal: 20,
              paddingBottom: 16 + insets.bottom,
              paddingTop: 8,
              gap: 6,
              width: '100%',
              maxWidth: wide ? 560 : undefined,
              alignSelf: 'center',
            }}
          >
            <Button label={primary} size="lg" onPress={next} disabled={busy} />
            {step > 0 && (
              <Button
                label="Geri"
                size="lg"
                kind="soft"
                onPress={() => setStep((s) => s - 1)}
                disabled={busy}
              />
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </Box>
  );
}

function Title({ text, sub }: { text: string; sub?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Txt size={26} weight={800} leading={1.2}>
        {text}
      </Txt>
      {!!sub && (
        <Txt size={14.5} color="muted">
          {sub}
        </Txt>
      )}
    </View>
  );
}

function IconFor({ name }: { name: string }) {
  const { colors } = useTheme();
  return <Icon name={name as 'clock'} size={16} color={colors['a2-ink']} strokeWidth={2.2} />;
}
