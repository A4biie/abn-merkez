// Dosyalar (0.11 bölüm 5, design/abn-09.html: .ftools / .fgrid / .file). Sohbet, pano ve wiki'ye yüklenen her şey.
// Üstte arama ve tür filtreleri, sağ üstte toplam sayı ve boyut. Dosyaya tıklayınca önizleme ve "Kaynağa git".

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Platform, TextInput, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Screen } from '@/components/layout/Screen';
import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { deleteFile, extOf, fileUrl, kindOf, sizeLabel, useFiles, type FileKind, type FileRow } from '@/lib/files';
import { fold } from '@/lib/palette';
import { useTeam } from '@/lib/team';
import { timeAgo } from '@/lib/time';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

const KINDS: [FileKind | 'hepsi', string][] = [
  ['hepsi', 'Tümü'],
  ['gorsel', 'Görsel'],
  ['ses', 'Ses'],
  ['video', 'Video'],
  ['belge', 'Belge'],
];
const ICON: Record<FileKind, string> = { gorsel: '🖼️', ses: '🎧', video: '🎬', belge: '📄' };
const TINT: Record<FileKind, string> = { gorsel: '#5A3A3A', ses: '#2B5E78', video: '#3E3A6E', belge: '#4A4A4A' };

const SPRING = 'cubic-bezier(0.2, 1.25, 0.35, 1)';
const mIn = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.97 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});
const fadeIn = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

export default function Dosyalar() {
  const { colors } = useTheme();
  const files = useFiles();
  const team = useTeam();
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(params.q ?? '');
  const [seenQ, setSeenQ] = useState(params.q);
  if (params.q !== seenQ) {
    setSeenQ(params.q);
    setQ(params.q ?? '');
  }
  const [kind, setKind] = useState<FileKind | 'hepsi'>('hepsi');
  const [open, setOpen] = useState<FileRow | null>(null);

  const all = files.data ?? [];
  const s = fold(q.trim());
  const list = all.filter((f) => (kind === 'hepsi' || kindOf(f) === kind) && (!s || fold(f.name + ' ' + f.source_label).includes(s)));
  const total = all.reduce((n, f) => n + (f.size ?? 0), 0);

  return (
    <Screen
      title="Dosyalar"
      crumb="Sohbet, panolar, görevler, buglar ve wiki'den"
      action={
        <Txt size={13} color="muted">
          {all.length} dosya · {sizeLabel(total)}
        </Txt>
      }
      onRefresh={files.refetch}
    >
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Dosya ara…"
          placeholderTextColor={colors.muted}
          aria-label="Dosya ara"
          style={[
            {
              flexGrow: 1,
              flexBasis: 220,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              color: colors.text,
              fontFamily: 'Urbanist',
              fontSize: 14,
            },
            { outlineStyle: 'none' } as object,
          ]}
        />
        <View style={{ flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: colors.surface }}>
          {KINDS.map(([k, label]) => (
            <Press
              key={k}
              onPress={() => setKind(k)}
              accessibilityState={{ selected: kind === k }}
              style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: kind === k ? colors.chip : undefined }}
            >
              <Txt size={12.5} weight={800} color={kind === k ? undefined : 'muted'}>
                {label}
              </Txt>
            </Press>
          ))}
        </View>
      </View>
      {files.loading && !all.length ? (
        <Txt color="muted">Yükleniyor…</Txt>
      ) : files.error ? (
        <Txt color="muted">Dosyalar yüklenemedi.</Txt>
      ) : list.length === 0 ? (
        <Txt color="muted" style={{ padding: 40, textAlign: 'center' }}>
          {q.trim() ? `"${q.trim()}" ile eşleşen dosya yok.` : 'Bu türde dosya yok.'}
        </Txt>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {list.map((f) => (
            <FileCard key={f.bucket + f.path} f={f} who={team.nameOf(f.uploaded_by)} onPress={() => setOpen(f)} />
          ))}
        </View>
      )}
      {open && <Preview f={open} onClose={() => setOpen(null)} />}
    </Screen>
  );
}

function Thumb({ f, height }: { f: FileRow; height: number }) {
  const k = kindOf(f);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (k === 'gorsel') fileUrl(f).then(setSrc);
  }, [f, k]);
  return (
    <View
      style={[
        { height, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
        { backgroundImage: `linear-gradient(160deg, ${TINT[k]}, color-mix(in srgb, ${TINT[k]} 50%, #000))` } as object,
      ]}
    >
      {src ? <Image source={{ uri: src }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' } as object} resizeMode="cover" /> : <Txt size={30}>{ICON[k]}</Txt>}
      {extOf(f.path) ? (
        <View style={{ position: 'absolute', left: 8, top: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(0,0,0,.5)' }}>
          <Txt size={10} weight={700} style={{ color: '#fff', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
            {extOf(f.path).toUpperCase()}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

function FileCard({ f, who, onPress }: { f: FileRow; who: string; onPress: () => void }) {
  const { colors } = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <Press
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      pressScale={0.98}
      style={{
        flexGrow: 1,
        flexBasis: 170,
        maxWidth: 260,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        boxShadow: `0 0 0 1px ${hover ? `color-mix(in srgb, ${colors.a1} 40%, transparent)` : colors.line}`,
      }}
    >
      <Thumb f={f} height={104} />
      <View style={{ paddingVertical: 9, paddingHorizontal: 11, gap: 2 }}>
        <Txt size={13} weight={800} numberOfLines={1}>
          {f.name}
        </Txt>
        <Txt size={11.5} color="muted" numberOfLines={1}>
          {f.source_label}
        </Txt>
        <Txt size={11.5} color="muted" numberOfLines={1}>
          {who} · {timeAgo(f.created_at)} · {sizeLabel(f.size)}
        </Txt>
      </View>
    </Press>
  );
}

function Preview({ f, onClose }: { f: FileRow; onClose: () => void }) {
  const { colors } = useTheme();
  const motion = useMotion();
  const team = useTeam();
  const say = useToast();
  const k = kindOf(f);
  const [src, setSrc] = useState('');
  const [confirm, setConfirm] = useState(false);
  const canDelete = f.uploaded_by === team.meId || team.isAdmin;
  useEffect(() => {
    fileUrl(f).then(setSrc);
  }, [f]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  const goSource = () => {
    onClose();
    if (f.source === 'sohbet' && f.source_id) router.navigate({ pathname: '/sohbet/[id]', params: { id: f.source_id } });
    else if (f.source === 'pano' && f.source_id) router.navigate({ pathname: '/panolar', params: { pano: f.source_id } });
    else if (f.source === 'wiki' && f.source_id) router.navigate({ pathname: '/wiki', params: { sayfa: f.source_id } });
  };
  const download = async () => {
    const u = await fileUrl(f, true);
    if (Platform.OS === 'web' && u) window.open(u, '_blank');
  };
  const remove = async () => {
    try {
      await deleteFile(f);
      onClose();
      say('Dosya silindi');
    } catch (e) {
      say((e as { message?: string }).message ?? 'Silinemedi');
    }
  };

  const pill = (label: string, onPress: () => void, primary = false, danger = false) => (
    <Press
      onPress={onPress}
      bg={primary ? 'a2' : undefined}
      gradient={primary ? 'btn' : undefined}
      style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: primary ? undefined : danger ? '#ED4245' : colors.chip }}
    >
      <Txt size={13} weight={800} color={primary ? 'a2-ink' : undefined} style={danger ? { color: '#fff' } : undefined}>
        {label}
      </Txt>
    </Press>
  );

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
          backgroundColor: 'rgba(0,0,0,0.6)',
          animationName: fadeIn,
          animationDuration: 180,
          animationFillMode: 'both',
        },
        Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as object) : null,
      ]}
    >
      <Press onPress={onClose} accessibilityLabel="Kapat" pressScale={1} style={{ position: 'absolute', inset: 0 } as object} />
      <Animated.View
        role="dialog"
        aria-label={f.name}
        style={{
          width: '100%',
          maxWidth: 760,
          maxHeight: '90%',
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: colors.surface,
          boxShadow: `0 0 0 1px ${colors.line}, 0 24px 60px rgba(0,0,0,.45)`,
          animationName: motion.reduced ? fadeIn : mIn,
          animationDuration: motion.reduced ? 150 : 260,
          animationTimingFunction: SPRING,
          animationFillMode: 'both',
        }}
      >
        <View style={{ backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
          {k === 'gorsel' && src ? (
            <Image source={{ uri: src }} style={{ width: '100%', height: 460 } as object} resizeMode="contain" />
          ) : k === 'ses' && src && Platform.OS === 'web' ? (
            <View style={{ padding: 30, width: '100%' }}>
              <audio src={src} controls autoPlay style={{ width: '100%' }} />
            </View>
          ) : k === 'video' && src && Platform.OS === 'web' ? (
            <video src={src} controls autoPlay style={{ width: '100%', maxHeight: 460 }} />
          ) : (
            <Thumb f={f} height={160} />
          )}
        </View>
        <View style={{ padding: 16, gap: 10 }}>
          <View>
            <Txt size={16} weight={800} numberOfLines={2}>
              {f.name}
            </Txt>
            <Txt size={12.5} color="muted">
              {f.source_label} · {team.nameOf(f.uploaded_by)} · {timeAgo(f.created_at)} · {sizeLabel(f.size)}
            </Txt>
          </View>
          {confirm ? (
            <View style={{ gap: 8 }}>
              <Txt size={13.5} weight={700}>
                Dosya silinsin mi? Kaynağından da silinir ({f.source === 'sohbet' ? 'mesajın eki kalkar' : f.source === 'pano' ? 'pano kartı silinir' : 'wiki sayfasında görünmez'}). Geri alınamaz.
              </Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {pill('Vazgeç', () => setConfirm(false))}
                {pill('Evet, sil', remove, false, true)}
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {pill('Kaynağa git', goSource, true)}
              {pill('⬇ İndir', download)}
              {canDelete && pill('Sil', () => setConfirm(true))}
              <View style={{ flex: 1 }} />
              {pill('Kapat', onClose)}
            </View>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}
