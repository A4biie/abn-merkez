// Oyun içinden bug bildirme penceresi ("hata", F8). Launcher ekran görüntüsünü, oyunun build numarasını ve
// bilgisayar bilgisini hazır verir; kişi sadece "Ne oldu?"yu yazar. Gönderince bug "Yeni" olarak açılır ve
// geçmişe "(launcher, F8)" yazılır. Esc ya da Vazgeç kapatır.

import { useEffect, useState } from 'react';
import { Image, TextInput, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Press } from '@/components/ui/Press';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/auth';
import { fetchBuilds, reportBug, SEV, type Severity } from '@/lib/bugs';
import { invoke } from '@/lib/desktop';
import { fetchProjects } from '@/lib/queries';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

type Info = { game_id: string | null; game_name: string | null; version: string | null; device: string; has_shot: boolean };

const SPRING = 'cubic-bezier(0.2, 1.25, 0.35, 1)';
const mIn = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.97 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});
const fadeIn = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

const close = () => invoke('bug_close').catch(() => {});
const fold = (s: string) => s.toLocaleLowerCase('tr').replace(/[^a-z0-9]/g, '');

export function BugQuick() {
  const { colors } = useTheme();
  const motion = useMotion();
  const { profile } = useAuth();
  const [info, setInfo] = useState<Info | null>(null);
  const [shot, setShot] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sev, setSev] = useState<Severity>('kritik');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    for (const el of [document.documentElement, document.body, document.getElementById('root')]) {
      if (el) el.style.background = 'transparent';
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    invoke<Info>('bug_info')
      .then(async (i) => {
        setInfo(i);
        if (!i.has_shot) return;
        const buf = await invoke<ArrayBuffer>('bug_shot');
        const f = new File([buf], 'ekran-goruntusu.png', { type: 'image/png' });
        setShot(f);
        setUrl(URL.createObjectURL(f));
      })
      .catch(() => setInfo({ game_id: null, game_name: null, version: null, device: '', has_shot: false }));
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function send() {
    const t = text.trim();
    if (!t || !profile || state === 'saving') return;
    setState('saving');
    try {
      // Oyunun projesi: adı ya da kısa adı oyunla eşleşen proje. Build: o projede aynı numaralı build.
      const [projects, builds] = await Promise.all([fetchProjects(), fetchBuilds()]);
      const g = fold(info?.game_name ?? '') || '#';
      const gid = fold(info?.game_id ?? '') || '#';
      const project = projects.find((p) => [fold(p.name), fold(p.slug ?? '')].some((x) => x && (x === g || x === gid)));
      const build = builds.find((b) => b.version === info?.version && (b.project_id ?? null) === (project?.id ?? null));
      const device = [info?.device, !build && info?.version ? 'oyun ' + info.version : ''].filter(Boolean).join(' · ');
      await reportBug({
        title: t.split('\n')[0].slice(0, 200),
        steps: t.split('\n').slice(1).map((s) => s.trim()).filter(Boolean),
        severity: sev,
        buildId: build?.id ?? null,
        projectId: project?.id ?? null,
        file: shot,
        userId: profile.id,
        device,
        via: 'launcher',
      });
      setState('saved');
      setTimeout(close, 1100);
    } catch {
      setState('error');
    }
  }

  return (
    <View style={{ flex: 1, padding: 14 }}>
      <Animated.View
        style={{
          flex: 1,
          borderRadius: 18,
          padding: 16,
          gap: 10,
          backgroundColor: colors.surface,
          boxShadow: `0 0 0 1px ${colors.line}, 0 16px 40px rgba(0,0,0,.45)`,
          animationName: motion.reduced ? fadeIn : mIn,
          animationDuration: motion.reduced ? 150 : 240,
          animationTimingFunction: SPRING,
          animationFillMode: 'both',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} {...({ 'data-tauri-drag-region': true } as object)}>
          <Txt size={16} weight={800} style={{ flex: 1 }}>
            🐞 Ne oldu?
          </Txt>
          <Txt size={11} color="muted" style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
            F8 · {info?.game_name ?? info?.game_id ?? 'oyun'} {info?.version ?? ''}
          </Txt>
        </View>
        {url ? (
          <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: '#000' }} resizeMode="contain" />
        ) : (
          <View style={{ height: 60, borderRadius: 10, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={12.5} color="muted">
              {info ? 'Ekran görüntüsü alınamadı' : 'Hazırlanıyor…'}
            </Txt>
          </View>
        )}
        <TextInput
          autoFocus
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={3}
          placeholder={'ör. Kapıya tıklayınca oyun dondu\n(alt satırlar: nasıl tekrar edilir)'}
          placeholderTextColor={colors.muted}
          onKeyPress={(e) => {
            const ev = e.nativeEvent as unknown as KeyboardEvent;
            if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) send();
          }}
          style={[
            {
              minHeight: 70,
              paddingVertical: 9,
              paddingHorizontal: 11,
              borderRadius: 10,
              backgroundColor: colors.surface2,
              borderWidth: 1,
              borderColor: colors.line,
              color: colors.text,
              fontSize: 14,
              fontFamily: 'Urbanist',
              textAlignVertical: 'top',
            },
            { outlineStyle: 'none' } as object,
          ]}
        />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(Object.keys(SEV) as Severity[]).map((k) => {
            const on = k === sev;
            return (
              <Press
                key={k}
                onPress={() => setSev(k)}
                style={{
                  paddingVertical: 5,
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
          <Txt size={11.5} color="muted" numberOfLines={1} style={{ flex: 1 }}>
            {state === 'saved' ? '✓ Bildirildi, teşekkürler' : state === 'error' ? 'Gönderilemedi, tekrar dene' : info?.device || ''}
          </Txt>
          <Press onPress={close} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.chip }}>
            <Txt size={13} weight={800}>
              Vazgeç
            </Txt>
          </Press>
          <Press onPress={send} bg="a2" gradient="btn" style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, opacity: state === 'saving' ? 0.6 : 1 }}>
            <Txt size={13} weight={800} color="a2-ink">
              {state === 'saving' ? 'Gönderiliyor…' : 'Gönder'}
            </Txt>
          </Press>
        </View>
      </Animated.View>
    </View>
  );
}
