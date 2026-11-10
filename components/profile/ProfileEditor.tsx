// Profili düzenle penceresi (profil bölüm 3, ABN Profil Prototipi: .edit). ~860 px; solda form, sağda canlı önizleme
// (mini kartla aynı ProfileCard). Kaydedilmemiş değişiklik varken alt çubuk çıkar; kapatmaya çalışınca çubuk sallanır.
// Görseller webde kırpılır, webp'ye çevrilip küçültülür (avatar 512 px, banner 1500 px) ve eski dosya silinir.

import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { Press } from '@/components/ui/Press';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/auth';
import { BANNER } from '@/lib/labels';
import { closeEditor, useEditorOpen } from '@/lib/profileModal';
import { uploadProfileImage } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { BannerColor, Profile } from '@/lib/types';
import { useMotion } from '@/theme/motion';
import { useTheme } from '@/theme/ThemeProvider';

import { useShadow } from './MiniProfile';
import { Label, ProfileCard } from './ProfileCard';

const SPRING = 'cubic-bezier(0.2, 1.25, 0.35, 1)';
const RED = '#ED4245';
const popIn = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 14 }, { scale: 0.97 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
});
const fadeIn = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const barIn = css.keyframes({
  from: { opacity: 0, transform: [{ translateY: 16 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
});
const shake = css.keyframes({
  '0%': { transform: [{ translateX: 0 }] },
  '20%': { transform: [{ translateX: -8 }] },
  '40%': { transform: [{ translateX: 8 }] },
  '60%': { transform: [{ translateX: -6 }] },
  '80%': { transform: [{ translateX: 4 }] },
  '100%': { transform: [{ translateX: 0 }] },
});

const AVATAR_COLORS = ['#C5B5FA', '#B8E986', '#7FDBFF', '#FFB3C7', '#FFD166', '#F4A261', '#9AA5B1', '#5865F2'];
const ACCENTS = ['#5865F2', '#3BA55D', '#ED4245', '#F0A92E', '#EB459E', '#00B0F4', '#9B59B6'];
const MAX_BYTES = 5 * 1024 * 1024;

type Img = { url: string | null; blob?: Blob; native?: ImagePicker.ImagePickerAsset };
type Draft = {
  full_name: string;
  pronouns: string;
  bio: string;
  work_hours: string;
  avatar_color: string;
  banner_color: string;
  accent_color: string | null;
  avatar: Img;
  banner: Img;
};
type Field = keyof Draft;

const fromProfile = (p: Profile): Draft => ({
  full_name: p.full_name ?? '',
  pronouns: p.pronouns ?? '',
  bio: p.bio ?? '',
  work_hours: p.work_hours ?? '',
  avatar_color: p.avatar_color,
  banner_color: p.banner_color,
  accent_color: p.accent_color ?? null,
  avatar: { url: p.avatar_url },
  banner: { url: p.banner_url },
});

function changed(a: Draft, b: Draft): Field[] {
  return (Object.keys(a) as Field[]).filter((k) =>
    k === 'avatar' || k === 'banner' ? a[k].url !== b[k].url : a[k] !== b[k],
  );
}

export function ProfileEditor() {
  const open = useEditorOpen();
  const { profile } = useAuth();
  if (!open || !profile) return null;
  return <Editor profile={profile} />;
}

function Editor({ profile }: { profile: Profile }) {
  const { colors } = useTheme();
  const { updateProfile } = useAuth();
  const motion = useMotion();
  const shadow = useShadow();
  const say = useToast();
  const { width } = useWindowDimensions();
  const [base, setBase] = useState(() => fromProfile(profile));
  const [d, setD] = useState(base);
  const [saving, setSaving] = useState(false);
  const [shakeN, setShakeN] = useState(0);
  const [flash, setFlash] = useState<{ n: number; fields: Field[] }>({ n: 0, fields: [] });
  const [crop, setCrop] = useState<{ kind: 'avatar' | 'banner'; src: string } | null>(null);
  const dirty = changed(d, base);
  const dirtyRef = useRef(dirty.length > 0);
  useEffect(() => {
    dirtyRef.current = dirty.length > 0;
  });
  const set = <K extends Field>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const tryClose = () => {
    if (dirtyRef.current) setShakeN((n) => n + 1);
    else closeEditor();
  };
  const tryCloseRef = useRef(tryClose);
  useEffect(() => {
    tryCloseRef.current = tryClose;
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      tryCloseRef.current();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.body.style.overflow = overflow;
    };
  }, []);

  const pick = async (kind: 'avatar' | 'banner') => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp,image/gif';
      input.onchange = () => {
        const f = input.files?.[0];
        if (!f) return;
        if (f.size > MAX_BYTES) return say('Görsel en fazla 5 MB olabilir');
        setCrop({ kind, src: URL.createObjectURL(f) });
      };
      input.click();
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === 'avatar' ? [1, 1] : [5, 2],
      quality: 0.8,
      base64: true,
    });
    const a = res.canceled ? null : res.assets[0];
    if (!a) return;
    if (a.fileSize && a.fileSize > MAX_BYTES) return say('Görsel en fazla 5 MB olabilir');
    set(kind, { url: a.uri, native: a });
  };

  async function upload(kind: 'avatar' | 'banner', img: Img): Promise<string | null> {
    const bucket = kind === 'avatar' ? 'avatars' : 'banners';
    if (img.blob) {
      const path = `${profile.id}/${Date.now()}.webp`;
      const { error } = await supabase.storage.from(bucket).upload(path, img.blob, { contentType: 'image/webp' });
      if (error) throw error;
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    }
    if (img.native) {
      const a = img.native;
      return uploadProfileImage(bucket, profile.id, { uri: a.uri, base64: a.base64, mimeType: a.mimeType, file: a.file });
    }
    return img.url;
  }

  const removeOld = async (kind: 'avatar' | 'banner', url: string | null) => {
    const bucket = kind === 'avatar' ? 'avatars' : 'banners';
    const marker = `/object/public/${bucket}/`;
    const i = url?.indexOf(marker) ?? -1;
    if (!url || i < 0) return;
    await supabase.storage.from(bucket).remove([decodeURIComponent(url.slice(i + marker.length))]);
  };

  const save = async () => {
    if (saving || !dirty.length) return;
    if (!d.full_name.trim()) return say('Görünen ad boş olamaz');
    setSaving(true);
    try {
      const avatar_url = dirty.includes('avatar') ? await upload('avatar', d.avatar) : base.avatar.url;
      const banner_url = dirty.includes('banner') ? await upload('banner', d.banner) : base.banner.url;
      const err = await updateProfile({
        full_name: d.full_name.trim(),
        pronouns: d.pronouns.trim(),
        bio: d.bio.trim(),
        work_hours: d.work_hours.trim(),
        avatar_color: d.avatar_color,
        banner_color: d.banner_color as BannerColor,
        accent_color: d.accent_color,
        avatar_url,
        banner_url,
      });
      if (err) {
        say(err);
        return;
      }
      if (dirty.includes('avatar')) removeOld('avatar', base.avatar.url).catch(() => {});
      if (dirty.includes('banner')) removeOld('banner', base.banner.url).catch(() => {});
      const next = { ...d, avatar: { url: avatar_url }, banner: { url: banner_url } };
      setFlash((f) => ({ n: f.n + 1, fields: dirty }));
      setBase(next);
      setD(next);
      say('Profil kaydedildi');
    } catch {
      say('Kaydedilemedi, tekrar dene');
    } finally {
      setSaving(false);
    }
  };

  const field = {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: 14.5,
    fontFamily: 'Urbanist',
    outlineStyle: 'none',
  } as object;

  const swatch = (c: string, on: boolean, onPress: () => void, label: string) => (
    <Press
      key={c}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: c,
        boxShadow: on ? `0 0 0 2px ${colors.surface}, 0 0 0 4px ${colors.text}` : `inset 0 0 0 1px rgba(0,0,0,.15)`,
      }}
    />
  );
  const colorInput = (value: string, onChange: (v: string) => void, label: string) =>
    Platform.OS === 'web' ? (
      <input
        type="color"
        aria-label={label}
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#5865F2'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        style={{ width: 30, height: 30, padding: 0, border: 'none', borderRadius: 15, background: 'none', cursor: 'pointer' }}
      />
    ) : null;
  const small = (label: string, onPress: () => void) => (
    <Press
      onPress={onPress}
      style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.chip }}
    >
      <Txt size={13} weight={800}>
        {label}
      </Txt>
    </Press>
  );
  const resolve = (k: string) => {
    const bg = BANNER[k as BannerColor]?.bg ?? k;
    return (colors as Record<string, string>)[bg] ?? bg;
  };

  const preview = {
    ...profile,
    full_name: d.full_name,
    pronouns: d.pronouns,
    bio: d.bio,
    avatar_color: d.avatar_color,
    banner_color: d.banner_color as BannerColor,
    accent_color: d.accent_color,
    avatar_url: d.avatar.url,
    banner_url: d.banner.url,
  };
  const wide = width >= 820;

  return (
    <Animated.View
      style={[
        {
          position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as 'absolute',
          inset: 0,
          zIndex: 1000,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          backgroundColor: 'rgba(0,0,0,0.5)',
          animationName: fadeIn,
          animationDuration: 160,
          animationFillMode: 'both',
        },
        Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as object) : null,
      ]}
    >
      <Press onPress={tryClose} accessibilityLabel="Kapat" pressScale={1} style={{ position: 'absolute', inset: 0 } as object} />
      <Animated.View
        role="dialog"
        aria-modal
        aria-label="Profili düzenle"
        style={{
          width: '100%',
          maxWidth: 860,
          maxHeight: '90%',
          borderRadius: 22,
          overflow: 'hidden',
          backgroundColor: colors.surface,
          boxShadow: `0 0 0 1px ${colors.line}, ${shadow}`,
          animationName: motion.reduced ? fadeIn : popIn,
          animationDuration: motion.reduced ? 150 : 260,
          animationTimingFunction: motion.reduced ? 'ease' : SPRING,
          animationFillMode: 'both',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, paddingBottom: 6 }}>
          <Txt size={20} weight={800} style={{ flex: 1 }}>
            Profili düzenle
          </Txt>
          <Press
            onPress={tryClose}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chip }}
          >
            <Txt size={15} weight={800}>
              ✕
            </Txt>
          </Press>
        </View>
        <View style={{ flexDirection: 'row', flexShrink: 1, minHeight: 0 }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingTop: 8, gap: 6, paddingBottom: 90 }}>
            <Row flash={flash} f="full_name" title="Görünen ad" extra={`${d.full_name.length}/32`}>
              <TextInput value={d.full_name} onChangeText={(v) => set('full_name', v)} maxLength={32} style={field} />
            </Row>
            <Row flash={flash} f="pronouns" title="Zamirler">
              <TextInput
                value={d.pronouns}
                onChangeText={(v) => set('pronouns', v)}
                maxLength={20}
                placeholder="o / onu"
                placeholderTextColor={colors.muted}
                style={field}
              />
            </Row>
            <Row flash={flash} f="avatar" title="Avatar">
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {small(d.avatar.url ? 'Görseli değiştir' : 'Görsel yükle', () => pick('avatar'))}
                {d.avatar.url ? small('Görseli kaldır', () => set('avatar', { url: null })) : null}
              </View>
            </Row>
            <Row flash={flash} f="avatar_color" title="Avatar rengi (görsel yokken)">
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {AVATAR_COLORS.map((c) => swatch(c, d.avatar_color.toUpperCase() === c, () => set('avatar_color', c), c))}
                {colorInput(d.avatar_color, (v) => set('avatar_color', v), 'Serbest avatar rengi')}
              </View>
            </Row>
            <Row flash={flash} f={['banner', 'banner_color']} title="Banner">
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {(Object.keys(BANNER) as BannerColor[]).map((k) =>
                  swatch(resolve(k), !d.banner.url && d.banner_color === k, () => {
                    set('banner_color', k);
                    set('banner', { url: null });
                  }, BANNER[k].label),
                )}
                {colorInput(d.banner_color.startsWith('#') ? d.banner_color : '#5865F2', (v) => {
                  set('banner_color', v);
                  set('banner', { url: null });
                }, 'Serbest banner rengi')}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {small(d.banner.url ? 'Görseli değiştir' : 'Görsel yükle', () => pick('banner'))}
                {d.banner.url ? small('Görseli kaldır', () => set('banner', { url: null })) : null}
              </View>
            </Row>
            <Row flash={flash} f="accent_color" title="Vurgu rengi">
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {swatch(colors.surface2, d.accent_color === null, () => set('accent_color', null), 'Vurgu yok')}
                {ACCENTS.map((c) => swatch(c, d.accent_color?.toUpperCase() === c, () => set('accent_color', c), c))}
                {colorInput(d.accent_color ?? '#5865F2', (v) => set('accent_color', v), 'Serbest vurgu rengi')}
              </View>
            </Row>
            <Row flash={flash} f="bio" title="Hakkında" extra={`${d.bio.length}/300`}>
              <TextInput
                value={d.bio}
                onChangeText={(v) => set('bio', v)}
                maxLength={300}
                multiline
                numberOfLines={4}
                placeholder="Kendinden biraz bahset"
                placeholderTextColor={colors.muted}
                style={[field, { minHeight: 96, textAlignVertical: 'top' }]}
              />
            </Row>
            <Row flash={flash} f="work_hours" title="Çalışma saatleri">
              <TextInput
                value={d.work_hours}
                onChangeText={(v) => set('work_hours', v)}
                maxLength={24}
                placeholder="Hafta içi 10:00–18:00"
                placeholderTextColor={colors.muted}
                style={field}
              />
            </Row>
          </ScrollView>
          {wide && (
            <View style={{ width: 340, padding: 18, paddingTop: 8, gap: 10, borderLeftWidth: 1, borderColor: colors.line }}>
              <Label>Önizleme</Label>
              <ProfileCard person={preview} isMe />
            </View>
          )}
        </View>
        {dirty.length > 0 && (
          <Animated.View
            key={'s' + shakeN}
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 8,
              paddingLeft: 16,
              paddingRight: 8,
              borderRadius: 16,
              backgroundColor: colors.bg,
              boxShadow: `0 0 0 ${shakeN ? 2 : 1}px ${shakeN ? RED : colors.line}, ${shadow}`,
              animationName: shakeN && !motion.reduced ? shake : barIn,
              animationDuration: shakeN ? 400 : 220,
              animationTimingFunction: shakeN ? 'ease' : SPRING,
              animationFillMode: 'both',
            }}
          >
            <Txt size={14} weight={700} style={{ flex: 1 }}>
              Kaydedilmemiş değişiklikler var
            </Txt>
            <Press
              onPress={() => {
                setD(base);
                setShakeN(0);
              }}
              style={{ paddingVertical: 9, paddingHorizontal: 14 }}
            >
              <Txt size={13.5} weight={800}>
                Sıfırla
              </Txt>
            </Press>
            <Press
              onPress={save}
              bg="a2"
              gradient="btn"
              style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 999, opacity: saving ? 0.6 : 1 }}
            >
              <Txt size={13.5} weight={800} color="a2-ink">
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Txt>
            </Press>
          </Animated.View>
        )}
      </Animated.View>
      {crop && (
        <CropDialog
          src={crop.src}
          aspect={crop.kind === 'avatar' ? 1 : 2.5}
          outW={crop.kind === 'avatar' ? 512 : 1500}
          round={crop.kind === 'avatar'}
          onCancel={() => setCrop(null)}
          onDone={(blob) => {
            set(crop.kind, { url: URL.createObjectURL(blob), blob });
            setCrop(null);
          }}
        />
      )}
    </Animated.View>
  );
}

function Row({ f, title, extra, children, flash }: { f: Field | Field[]; title: string; extra?: string; children: React.ReactNode; flash: { n: number; fields: Field[] } }) {
const { colors } = useTheme();
  const fs = Array.isArray(f) ? f : [f];
  const lit = flash.n > 0 && fs.some((x) => flash.fields.includes(x));
  return (
    <Animated.View
      key={lit ? 'f' + flash.n : 'n'}
      style={[
        { gap: 8, padding: 10, marginHorizontal: -10, borderRadius: 14 },
        lit
          ? {
              animationName: css.keyframes({
                from: { backgroundColor: `color-mix(in srgb, ${colors.a1} 28%, transparent)` },
                to: { backgroundColor: 'transparent' },
              }),
              animationDuration: 1200,
              animationFillMode: 'both',
            }
          : null,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Label>{title}</Label>
        {extra ? (
          <Txt size={11.5} weight={700} color="muted" style={{ marginLeft: 'auto' }}>
            {extra}
          </Txt>
        ) : null}
      </View>
      {children}
    </Animated.View>
  );
}

/** Webde görseli sürükle + yakınlaştır ile kırpar; sonucu webp olarak verir. */
function CropDialog({
  src,
  aspect,
  outW,
  round,
  onCancel,
  onDone,
}: {
  src: string;
  aspect: number;
  outW: number;
  round: boolean;
  onCancel: () => void;
  onDone: (b: Blob) => void;
}) {
  const { colors } = useTheme();
  const say = useToast();
  const W = round ? 300 : 440;
  const H = W / aspect;
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const i = new window.Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);

  const base = img ? Math.max(W / img.naturalWidth, H / img.naturalHeight) : 1;
  const s = base * zoom;
  const iw = (img?.naturalWidth ?? 0) * s;
  const ih = (img?.naturalHeight ?? 0) * s;
  const clamp = (p: { x: number; y: number }) => ({
    x: Math.min(0, Math.max(W - iw, p.x)),
    y: Math.min(0, Math.max(H - ih, p.y)),
  });
  // İlk açılışta ortala; yakınlaştırınca sınırlar içinde tut.
  const p = img && pos.x === 0 && pos.y === 0 && zoom === 1 ? clamp({ x: (W - iw) / 2, y: (H - ih) / 2 }) : clamp(pos);

  const done = () => {
    if (!img) return;
    const k = outW / W;
    const c = document.createElement('canvas');
    c.width = outW;
    c.height = Math.round(H * k);
    c.getContext('2d')?.drawImage(img, p.x * k, p.y * k, iw * k, ih * k);
    c.toBlob((b) => (b ? onDone(b) : say('Görsel hazırlanamadı')), 'image/webp', 0.85);
  };

  return (
    <View
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
      } as object}
    >
      <View style={{ padding: 18, gap: 14, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center' }}>
        <Txt size={16} weight={800}>
          Görseli kırp
        </Txt>
        <div
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { sx: e.clientX, sy: e.clientY, x: p.x, y: p.y };
          }}
          onPointerMove={(e) => {
            const g = drag.current;
            if (g) setPos(clamp({ x: g.x + e.clientX - g.sx, y: g.y + e.clientY - g.sy }));
          }}
          onPointerUp={() => (drag.current = null)}
          style={{
            width: W,
            height: H,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: round ? W / 2 : 12,
            cursor: 'grab',
            touchAction: 'none',
            background: colors.surface2,
          }}
        >
          {img && (
            <img
              src={src}
              alt=""
              draggable={false}
              style={{ position: 'absolute', left: p.x, top: p.y, width: iw, height: ih, userSelect: 'none', pointerEvents: 'none' }}
            />
          )}
        </div>
        <input
          type="range"
          aria-label="Yakınlaştır"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => {
            setPos(p);
            setZoom(Number(e.target.value));
          }}
          style={{ width: W }}
        />
        <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch', justifyContent: 'flex-end' }}>
          <Press onPress={onCancel} style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.chip }}>
            <Txt size={13.5} weight={800}>
              Vazgeç
            </Txt>
          </Press>
          <Press onPress={done} bg="a2" gradient="btn" style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 999 }}>
            <Txt size={13.5} weight={800} color="a2-ink">
              Uygula
            </Txt>
          </Press>
        </View>
      </View>
    </View>
  );
}
