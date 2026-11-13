// "🐞 Bug bildir" formu (0.11 bölüm 6, design/abn-09.html: bugForm). Ne oldu, adımlar, ciddiyet, build,
// ekran görüntüsü (sürükle bırak ya da Ctrl+V). Sohbetten açılınca mesaj alıntısı ve bildiren mesajı yazan olur.

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Choice, Lab } from '@/components/chat/ConvertTaskModal';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { closeBugForm, deviceInfo, reportBug, SEV, useBugForm, useBuilds, type Severity } from '@/lib/bugs';
import { guessTitle } from '@/lib/convert';
import { useTeam } from '@/lib/team';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

const SPRING = 'cubic-bezier(0.2, 1.25, 0.35, 1)';
const mIn = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.97 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});
const fadeIn = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

export function BugForm() {
  const req = useBugForm();
  if (!req) return null;
  return <Form key={req.message?.id ?? 'yeni'} req={req} />;
}

function Form({ req }: { req: NonNullable<ReturnType<typeof useBugForm>> }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const team = useTeam();
  const say = useToast();
  const builds = useBuilds();
  const [title, setTitle] = useState(req.title ?? (req.message ? guessTitle(req.message.body) : ''));
  const [steps, setSteps] = useState('');
  const [sev, setSev] = useState<Severity>('kritik');
  const [project, setProject] = useState(req.projectId ?? '');
  const [build, setBuild] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const zone = useRef<unknown>(null);

  const projBuilds = (builds.data ?? []).filter((b) => (b.project_id ?? '') === project);
  const buildValue = build || projBuilds[0]?.id || '';

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    if (!/^(image|video)\//.test(f.type)) return say('Sadece görsel ya da video');
    if (f.size > 50 * 1024 * 1024) return say('Dosya en fazla 50 MB olabilir');
    setFile(f);
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  };
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });

  // Esc kapatır, Ctrl+V ile ekran görüntüsü yapıştırılır, kutuya sürükle bırak.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeBugForm();
      }
    };
    const paste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? [])[0];
      if (f) {
        e.preventDefault();
        pickRef.current(f);
      }
    };
    const el = zone.current as HTMLElement | null;
    const dover = (e: DragEvent) => {
      e.preventDefault();
      setOver(true);
    };
    const dleave = () => setOver(false);
    const ddrop = (e: DragEvent) => {
      e.preventDefault();
      setOver(false);
      pickRef.current(e.dataTransfer?.files?.[0]);
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('paste', paste);
    el?.addEventListener('dragover', dover);
    el?.addEventListener('dragleave', dleave);
    el?.addEventListener('drop', ddrop);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('paste', paste);
      el?.removeEventListener('dragover', dover);
      el?.removeEventListener('dragleave', dleave);
      el?.removeEventListener('drop', ddrop);
    };
  }, []);

  const browse = () => {
    if (Platform.OS !== 'web') return;
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = 'image/*,video/mp4,video/webm';
    i.onchange = () => pick(i.files?.[0]);
    i.click();
  };

  const submit = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const id = await reportBug({
        title: t,
        steps: steps.split('\n').map((s) => s.trim()).filter(Boolean),
        severity: sev,
        buildId: buildValue || null,
        projectId: project || null,
        file,
        userId: team.meId,
        device: deviceInfo(),
        message: req.message ?? null,
      });
      closeBugForm();
      say('Bug bildirildi');
      router.navigate({ pathname: '/buglar', params: { bug: id } });
    } catch (e) {
      say((e as { message?: string }).message ?? 'Bildirilemedi');
      setBusy(false);
    }
  };

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
  const author = req.message ? team.person(req.message.author_id) : undefined;

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
      <Press onPress={closeBugForm} accessibilityLabel="Kapat" pressScale={1} style={{ position: 'absolute', inset: 0 } as object} />
      <Animated.View
        role="dialog"
        aria-label="Bug bildir"
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '92%',
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
            🐞 Bug bildir
          </Txt>
          {req.message && (
            <View style={{ borderLeftWidth: 3, borderLeftColor: colors.a1, paddingVertical: 6, paddingHorizontal: 10, borderTopRightRadius: 8, borderBottomRightRadius: 8, backgroundColor: colors.surface2 }}>
              <Txt size={13} color="text-2" numberOfLines={4}>
                <Txt size={13} weight={800}>
                  {(author?.full_name ?? 'Eski üye') + ': '}
                </Txt>
                {req.message.body}
              </Txt>
            </View>
          )}
          <View style={{ gap: 6 }}>
            <Lab>Ne oldu?</Lab>
            <TextInput
              autoFocus={!title}
              value={title}
              onChangeText={setTitle}
              maxLength={200}
              placeholder="ör. Bodrum kapısına tıklayınca oyun donuyor"
              placeholderTextColor={colors.muted}
              style={field}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Lab>Nasıl tekrar edilir? (her satır bir adım)</Lab>
            <TextInput
              autoFocus={!!title}
              value={steps}
              onChangeText={setSteps}
              multiline
              numberOfLines={3}
              placeholder={"Bölüm 3'ü başlat\nBodruma in\nKapıya tıkla"}
              placeholderTextColor={colors.muted}
              style={[field, { minHeight: 76, textAlignVertical: 'top' }]}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Lab>Ne kadar ciddi?</Lab>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {(Object.keys(SEV) as Severity[]).map((k) => {
                const on = k === sev;
                return (
                  <Press
                    key={k}
                    onPress={() => setSev(k)}
                    accessibilityState={{ selected: on }}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      backgroundColor: on ? `color-mix(in srgb, ${SEV[k].color} 22%, transparent)` : colors.surface2,
                      boxShadow: on ? `inset 0 0 0 1px ${SEV[k].color}` : undefined,
                    }}
                  >
                    <Txt size={12} weight={800} style={{ color: on ? SEV[k].color : colors.muted }}>
                      {SEV[k].label}
                    </Txt>
                  </Press>
                );
              })}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <View style={{ gap: 6, flex: 1, minWidth: 180 }}>
              <Lab>Proje</Lab>
              <Choice
                label="Proje"
                value={project}
                options={[{ value: '', label: 'Projesiz' }, ...team.projects.map((p) => ({ value: p.id, label: p.name }))]}
                onChange={(v) => {
                  setProject(v);
                  setBuild('');
                }}
              />
            </View>
            <View style={{ gap: 6, flex: 1, minWidth: 180 }}>
              <Lab>Build</Lab>
              <Choice
                label="Build"
                value={buildValue}
                options={[...projBuilds.map((b) => ({ value: b.id, label: b.version })), { value: '', label: 'Bilmiyorum' }]}
                onChange={setBuild}
              />
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Lab>Ekran görüntüsü</Lab>
            <View
              ref={zone as never}
              style={{
                borderRadius: 10,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: over ? colors.a1 : colors.line,
                backgroundColor: over ? `color-mix(in srgb, ${colors.a1} 10%, transparent)` : colors.surface2,
                padding: 10,
                gap: 8,
              }}
            >
              {preview ? (
                <img src={preview} alt="" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, objectFit: 'contain' }} />
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt size={13} color="muted" style={{ flex: 1 }} numberOfLines={1}>
                  {file ? '📎 ' + file.name : '📎 Sürükle bırak ya da yapıştır (Ctrl+V)'}
                </Txt>
                {file ? (
                  <Press
                    onPress={() => {
                      setFile(null);
                      setPreview(null);
                    }}
                  >
                    <Txt size={12} weight={800} color="muted">
                      Kaldır
                    </Txt>
                  </Press>
                ) : (
                  <Press onPress={browse}>
                    <Txt size={12} weight={800}>
                      Dosya seç
                    </Txt>
                  </Press>
                )}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Txt size={12} color="muted" style={{ marginRight: 'auto' }}>
              Oyun içinden: launcher&apos;da F8
            </Txt>
            <Press onPress={closeBugForm} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.chip }}>
              <Txt size={13} weight={800}>
                Vazgeç
              </Txt>
            </Press>
            <Press onPress={submit} bg="a2" gradient="btn" style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, opacity: busy ? 0.6 : 1 }}>
              <Txt size={13} weight={800} color="a2-ink">
                {busy ? 'Bildiriliyor…' : 'Bildir'}
              </Txt>
            </Press>
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}
